#!/usr/bin/env python3
"""
Streamlit dashboard for exploring Trace MLX synthetic dataset.
Run: streamlit run streamlit_explorer.py
"""
import json
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from collections import Counter

st.set_page_config(
    page_title="Trace MLX Dataset Explorer",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Helpers ────────────────────────────────────────────────────────────────

@st.cache_data
def load_jsonl(path: str) -> pd.DataFrame:
    """Load JSONL chat-format dataset into a flat DataFrame."""
    records = []
    for line in Path(path).read_text().splitlines():
        if not line.strip():
            continue
        ex = json.loads(line)
        query = ""
        labels = {}
        for msg in ex.get("messages", []):
            if msg["role"] == "user":
                user_content = json.loads(msg["content"])
                query = user_content.get("query", "")
            elif msg["role"] == "assistant":
                labels = json.loads(msg["content"])
        synth_domain = labels.get("synthetic_domain", "")
        synth_round = labels.get("synthetic_round", "")
        synth_qidx = labels.get("synthetic_query_index", "")
        
        records.append({
            "query": query,
            "intent_classification": labels.get("intent_classification", ""),
            "domain_alignment": labels.get("domain_alignment", ""),
            "risk_level": labels.get("risk_level", ""),
            "risk_signals": ", ".join(labels.get("risk_signals", [])),
            "operator_narrative": labels.get("operator_narrative", ""),
            "recommended_workflow": labels.get("recommended_workflow", ""),
            "synthetic_domain": synth_domain,
            "synthetic_round": synth_round,
            "synthetic_query_index": synth_qidx,
        })
    return pd.DataFrame(records)

@st.cache_data
def load_predictions(path: str) -> pd.DataFrame:
    """Load model predictions JSONL."""
    records = []
    for line in Path(path).read_text().splitlines():
        if not line.strip():
            continue
        pred = json.loads(line)
        records.append(pred)
    return pd.DataFrame(records)

@st.cache_data
def load_summary(path: str) -> dict:
    return json.loads(Path(path).read_text())

# ─── Load Data ──────────────────────────────────────────────────────────────

# Get the project root (2 levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "datasets" / "trace-enterprise-full"
TRAIN_PATH = DATA_DIR / "train.jsonl"
VALID_PATH = DATA_DIR / "valid.jsonl"
TEST_PATH = DATA_DIR / "test.jsonl"
SUMMARY_PATH = DATA_DIR / "summary.json"

train_df = load_jsonl(TRAIN_PATH)
valid_df = load_jsonl(VALID_PATH)
test_df = load_jsonl(TEST_PATH)
summary = load_summary(SUMMARY_PATH)

# Try to load adapter predictions if they exist
ADAPTER_PREDS_PATH = DATA_DIR / "adapter-predictions-full.jsonl"
BASELINE_PREDS_PATH = DATA_DIR / "baseline-predictions.jsonl"
adapter_df = load_predictions(ADAPTER_PREDS_PATH) if ADAPTER_PREDS_PATH.exists() else pd.DataFrame()
baseline_df = load_predictions(BASELINE_PREDS_PATH) if BASELINE_PREDS_PATH.exists() else pd.DataFrame()

# ─── Sidebar ────────────────────────────────────────────────────────────────

st.sidebar.title("🔍 Trace MLX Explorer")
st.sidebar.markdown("---")

split = st.sidebar.selectbox("Dataset Split", ["train", "valid", "test", "all"], index=0)
if split == "train":
    df = train_df
elif split == "valid":
    df = valid_df
elif split == "test":
    df = test_df
else:
    df = pd.concat([train_df, valid_df, test_df], ignore_index=True)

# Filters
st.sidebar.markdown("### Filters")
intents = st.sidebar.multiselect(
    "Intent Classification",
    options=sorted(df["intent_classification"].unique()),
    default=sorted(df["intent_classification"].unique())
)
risks = st.sidebar.multiselect(
    "Risk Level",
    options=sorted(df["risk_level"].unique()),
    default=sorted(df["risk_level"].unique())
)
domains = st.sidebar.multiselect(
    "Domain Alignment",
    options=sorted(df["domain_alignment"].unique()),
    default=sorted(df["domain_alignment"].unique())
)
synth_domains = st.sidebar.multiselect(
    "Synthetic Domain",
    options=sorted(df["synthetic_domain"].unique()),
    default=sorted(df["synthetic_domain"].unique())
)

# Apply filters
mask = (
    df["intent_classification"].isin(intents) &
    df["risk_level"].isin(risks) &
    df["domain_alignment"].isin(domains) &
    df["synthetic_domain"].isin(synth_domains)
)
filtered = df[mask]

# Search
search = st.sidebar.text_input("🔎 Search queries", "")
if search:
    filtered = filtered[filtered["query"].str.contains(search, case=False, na=False)]

st.sidebar.markdown("---")
st.sidebar.metric("Total Examples", len(df))
st.sidebar.metric("Filtered", len(filtered))

# ─── Main Tabs ──────────────────────────────────────────────────────────────

tab_overview, tab_distribution, tab_examples, tab_signals, tab_comparison = st.tabs([
    "📊 Overview", "📈 Distributions", "📝 Examples", "🏷️ Risk Signals", "⚖️ Model Comparison"
])

# ─── Overview Tab ───────────────────────────────────────────────────────────
with tab_overview:
    col1, col2, col3 = st.columns(3)
    col1.metric("Train", len(train_df))
    col2.metric("Valid", len(valid_df))
    col3.metric("Test", len(test_df))
    
    st.markdown("### Dataset Summary")
    st.json(summary.get("summary", summary))
    
    st.markdown("### Label Distribution (All Splits)")
    for split_name, split_df in [("train", train_df), ("valid", valid_df), ("test", test_df)]:
        with st.expander(f"{split_name.capitalize()} ({len(split_df)} examples)"):
            c1, c2, c3 = st.columns(3)
            with c1:
                st.write("**Intent**")
                st.bar_chart(split_df["intent_classification"].value_counts())
            with c2:
                st.write("**Risk**")
                st.bar_chart(split_df["risk_level"].value_counts())
            with c3:
                st.write("**Domain**")
                st.bar_chart(split_df["domain_alignment"].value_counts())

# ─── Distributions Tab ──────────────────────────────────────────────────────
with tab_distribution:
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Intent × Risk Heatmap")
        heatmap_data = filtered.groupby(["intent_classification", "risk_level"]).size().unstack(fill_value=0)
        fig = px.imshow(
            heatmap_data,
            labels=dict(x="Risk Level", y="Intent", color="Count"),
            color_continuous_scale="Blues",
            text_auto=True
        )
        fig.update_layout(height=400)
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Intent × Domain Heatmap")
        heatmap_data2 = filtered.groupby(["intent_classification", "domain_alignment"]).size().unstack(fill_value=0)
        fig2 = px.imshow(
            heatmap_data2,
            labels=dict(x="Domain Alignment", y="Intent", color="Count"),
            color_continuous_scale="Greens",
            text_auto=True
        )
        fig2.update_layout(height=400)
        st.plotly_chart(fig2, use_container_width=True)
    
    # Query length distribution
    filtered["query_length"] = filtered["query"].str.len()
    st.subheader("Query Length Distribution")
    fig3 = px.histogram(filtered, x="query_length", nbins=30, color="risk_level")
    st.plotly_chart(fig3, use_container_width=True)
    
    # Synthetic round distribution
    if "synthetic_round" in filtered.columns and filtered["synthetic_round"].notna().any():
        st.subheader("Synthetic Round Distribution")
        round_counts = filtered["synthetic_round"].value_counts().sort_index()
        fig4 = px.bar(x=round_counts.index.astype(str), y=round_counts.values, labels={"x": "Round", "y": "Count"})
        st.plotly_chart(fig4, use_container_width=True)

# ─── Examples Tab ───────────────────────────────────────────────────────────
with tab_examples:
    st.subheader(f"Examples ({len(filtered)} total)")
    
    page_size = st.selectbox("Rows per page", [10, 25, 50, 100], index=1)
    total_pages = max(1, (len(filtered) + page_size - 1) // page_size)
    page = st.number_input("Page", min_value=1, max_value=total_pages, value=1) - 1
    
    start = page * page_size
    end = min(start + page_size, len(filtered))
    page_df = filtered.iloc[start:end].reset_index(drop=True)
    
    for idx, row in page_df.iterrows():
        with st.expander(f"{start + idx + 1}. {row['query'][:80]}..." if len(row['query']) > 80 else f"{start + idx + 1}. {row['query']}"):
            col1, col2 = st.columns([2, 1])
            with col1:
                st.markdown("**Query**")
                st.code(row["query"])
                st.markdown("**Operator Narrative**")
                st.write(row["operator_narrative"])
                st.markdown("**Recommended Workflow**")
                st.write(row["recommended_workflow"])
            with col2:
                st.markdown("**Labels**")
                st.json({
                    "intent_classification": row["intent_classification"],
                    "domain_alignment": row["domain_alignment"],
                    "risk_level": row["risk_level"],
                    "risk_signals": row["risk_signals"].split(", ") if row["risk_signals"] else [],
                    "synthetic_domain": row["synthetic_domain"],
                    "synthetic_round": row["synthetic_round"],
                })

# ─── Risk Signals Tab ───────────────────────────────────────────────────────
with tab_signals:
    st.subheader("Risk Signal Analysis")
    
    all_signals = []
    for signals_str in filtered["risk_signals"]:
        if signals_str:
            all_signals.extend([s.strip() for s in signals_str.split(",")])
    
    signal_counts = Counter(all_signals)
    
    if signal_counts:
        signal_df = pd.DataFrame(signal_counts.items(), columns=["signal", "count"]).sort_values("count", ascending=False)
        
        col1, col2 = st.columns([2, 1])
        with col1:
            fig = px.bar(signal_df.head(20), x="count", y="signal", orientation="h", title="Top 20 Risk Signals")
            fig.update_layout(yaxis={'categoryorder': 'total ascending'}, height=500)
            st.plotly_chart(fig, use_container_width=True)
        with col2:
            st.dataframe(signal_df, use_container_width=True, height=500)
    
    # Risk signals by intent
    st.subheader("Risk Signals by Intent")
    signal_by_intent = {}
    for _, row in filtered.iterrows():
        intent = row["intent_classification"]
        signals = [s.strip() for s in row["risk_signals"].split(",")] if row["risk_signals"] else []
        for s in signals:
            signal_by_intent.setdefault(intent, Counter())[s] += 1
    
    all_intents = sorted(set(filtered["intent_classification"]))
    all_signals_unique = sorted(set(all_signals))
    heatmap_matrix = []
    for intent in all_intents:
        row = []
        for sig in all_signals_unique:
            row.append(signal_by_intent.get(intent, Counter()).get(sig, 0))
        heatmap_matrix.append(row)
    
    fig = px.imshow(
        heatmap_matrix,
        x=all_signals_unique,
        y=all_intents,
        labels=dict(x="Risk Signal", y="Intent", color="Count"),
        color_continuous_scale="Reds",
        aspect="auto"
    )
    fig.update_layout(height=300)
    st.plotly_chart(fig, use_container_width=True)

# ─── Model Comparison Tab ───────────────────────────────────────────────────
with tab_comparison:
    st.subheader("Adapter vs Baseline Comparison")
    
    if not adapter_df.empty:
        # Parse ground truth from test set
        test_labels = []
        for _, row in test_df.iterrows():
            for msg in row.get("messages", []):
                if msg["role"] == "assistant":
                    test_labels.append(json.loads(msg["content"]))
                    break
        
        gt_df = pd.DataFrame(test_labels)
        
        # Adapter predictions
        adapter_preds = []
        for _, row in adapter_df.iterrows():
            adapter_preds.append({
                "intent_classification": row.get("intent_classification", ""),
                "domain_alignment": row.get("domain_alignment", ""),
                "risk_level": row.get("risk_level", ""),
            })
        adapter_preds_df = pd.DataFrame(adapter_preds)
        
        st.write(f"Ground Truth: {len(gt_df)} | Adapter Predictions: {len(adapter_preds_df)}")
        
        if len(gt_df) == len(adapter_preds_df):
            acc_intent = (gt_df["intent_classification"] == adapter_preds_df["intent_classification"]).mean()
            acc_risk = (gt_df["risk_level"] == adapter_preds_df["risk_level"]).mean()
            acc_domain = (gt_df["domain_alignment"] == adapter_preds_df["domain_alignment"]).mean()
            
            c1, c2, c3 = st.columns(3)
            c1.metric("Intent Accuracy", f"{acc_intent:.1%}")
            c2.metric("Risk Accuracy", f"{acc_risk:.1%}")
            c3.metric("Domain Accuracy", f"{acc_domain:.1%}")
            
            # Confusion matrix for intent
            st.subheader("Intent Confusion Matrix")
            from sklearn.metrics import confusion_matrix
            labels = sorted(set(gt_df["intent_classification"]) | set(adapter_preds_df["intent_classification"]))
            cm = confusion_matrix(gt_df["intent_classification"], adapter_preds_df["intent_classification"], labels=labels)
            
            fig = px.imshow(
                cm,
                x=labels,
                y=labels,
                labels=dict(x="Predicted", y="Actual", color="Count"),
                color_continuous_scale="Blues",
                text_auto=True
            )
            fig.update_layout(height=400)
            st.plotly_chart(fig, use_container_width=True)
            
            # Confusion matrix for risk
            st.subheader("Risk Level Confusion Matrix")
            risk_labels = sorted(set(gt_df["risk_level"]) | set(adapter_preds_df["risk_level"]))
            cm_risk = confusion_matrix(gt_df["risk_level"], adapter_preds_df["risk_level"], labels=risk_labels)
            
            fig2 = px.imshow(
                cm_risk,
                x=risk_labels,
                y=risk_labels,
                labels=dict(x="Predicted", y="Actual", color="Count"),
                color_continuous_scale="Reds",
                text_auto=True
            )
            fig2.update_layout(height=300)
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.warning("Ground truth and prediction counts don't match.")
    else:
        st.info("No adapter predictions found. Run batch inference first.")

# ─── Footer ─────────────────────────────────────────────────────────────────
st.markdown("---")
st.caption("Trace MLX Dataset Explorer | Built with Streamlit + Plotly")