#!/usr/bin/env python3
"""
FastAPI wrapper for MLX model with OpenAI-compatible endpoints.
Supports two modes:
- local-hermes-nemotron: with adapter for Trace classification
- local-hermes-base: base model for analysis/generation tasks
"""
import json
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from mlx_lm import load, generate
from mlx_lm.sample_utils import make_logits_processors, make_sampler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model states
classification_model = None
classification_tokenizer = None
base_model = None
base_tokenizer = None

# ─── Configuration ──────────────────────────────────────────────────────────
MODEL_PATH = "mlx-community/Qwen2.5-1.5B-Instruct-4bit"
ADAPTER_PATH = ".trace/adapters/trace-enterprise-full-600"
HOST = "0.0.0.0"
PORT = 9001

# ─── Pydantic Models ────────────────────────────────────────────────────────

class ChatCompletionRequest(BaseModel):
    model: str = "local-hermes-nemotron"
    messages: List[Dict[str, str]]
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 40
    min_p: float = 0.0
    max_tokens: int = 256
    max_completion_tokens: Optional[int] = None
    stop: Optional[List[str]] = None
    stream: bool = False
    logprobs: bool = False
    seed: Optional[int] = None
    repetition_penalty: float = 1.0
    repetition_context_size: int = 20
    xtc_probability: float = 0.0
    xtc_threshold: float = 0.0
    logit_bias: Optional[Dict[int, float]] = None
    num_draft_tokens: int = 0

class CompletionRequest(BaseModel):
    model: str = "local-hermes-nemotron"
    prompt: str
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 40
    min_p: float = 0.0
    max_tokens: int = 256
    max_completion_tokens: Optional[int] = None
    stop: Optional[List[str]] = None
    stream: bool = False
    logprobs: bool = False
    seed: Optional[int] = None
    repetition_penalty: float = 1.0
    repetition_context_size: int = 20
    xtc_probability: float = 0.0
    xtc_threshold: float = 0.0
    logit_bias: Optional[Dict[int, float]] = None
    num_draft_tokens: int = 0

class ChatChoice(BaseModel):
    index: int
    message: Dict[str, str]
    finish_reason: str = "stop"
    logprobs: Optional[Any] = None

class CompletionChoice(BaseModel):
    index: int
    text: str
    finish_reason: str = "stop"
    logprobs: Optional[Any] = None

class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Usage

class CompletionResponse(BaseModel):
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[CompletionChoice]
    usage: Usage

# ─── Helper Functions ───────────────────────────────────────────────────────

CLASSIFICATION_SYSTEM_PROMPT = """You are the Trace usage-intelligence adapter.
Classify managed enterprise AI usage and return compact JSON with:
intent_classification, domain_alignment, risk_level, risk_signals, operator_narrative, recommended_workflow."""

ANALYSIS_SYSTEM_PROMPT = """You are an expert system optimization agent for Trace, an AI governance platform.
Analyze telemetry data and return structured JSON with insights."""

def get_model_and_tokenizer(model_name: str):
    """Return the appropriate model/tokenizer pair based on model name."""
    global classification_model, classification_tokenizer, base_model, base_tokenizer
    
    if model_name == "local-hermes-base":
        # Use lifespan-loaded globals first
        if base_model is not None and base_tokenizer is not None:
            return base_model, base_tokenizer
        # Fallback: load on demand
        if base_model is None or base_tokenizer is None:
            logger.info(f"Loading base model from {MODEL_PATH} (no adapter)...")
            base_model, base_tokenizer = load(MODEL_PATH, adapter_path=None)
        return base_model, base_tokenizer
    else:
        # Use lifespan-loaded globals first
        if classification_model is not None and classification_tokenizer is not None:
            return classification_model, classification_tokenizer
        # Fallback: load on demand
        if classification_model is None or classification_tokenizer is None:
            logger.info(f"Loading classification model from {MODEL_PATH} with adapter {ADAPTER_PATH}...")
            classification_model, classification_tokenizer = load(MODEL_PATH, adapter_path=ADAPTER_PATH)
        return classification_model, classification_tokenizer

def get_tokenizer(model_name: str):
    """Get the appropriate tokenizer for the model."""
    global classification_tokenizer, base_tokenizer
    if model_name == "local-hermes-base":
        if base_tokenizer is None:
            _, tok = load(MODEL_PATH, adapter_path=None)
            base_tokenizer = tok
        return base_tokenizer
    else:
        if classification_tokenizer is None:
            _, tok = load(MODEL_PATH, adapter_path=ADAPTER_PATH)
            classification_tokenizer = tok
        return classification_tokenizer

def build_chat_prompt(messages: List[Dict[str, str]], system_prompt: Optional[str] = None, tokenizer=None) -> str:
    """Build prompt from chat messages using the tokenizer's chat template."""
    if tokenizer is None:
        tokenizer = get_tokenizer("local-hermes-nemotron")
    
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({"role": msg["role"], "content": msg["content"]})
    
    if system_prompt and not any(m["role"] == "system" for m in formatted_messages):
        formatted_messages.insert(0, {"role": "system", "content": system_prompt})
    
    return tokenizer.apply_chat_template(
        formatted_messages, 
        tokenize=False, 
        add_generation_prompt=True
    )

def count_tokens(text: str, tokenizer=None) -> int:
    if tokenizer is None:
        tokenizer = get_tokenizer("local-hermes-nemotron")
    return len(tokenizer.encode(text))

# ─── FastAPI App ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load both models
    global classification_model, base_model, classification_tokenizer, base_tokenizer
    logger.info("Loading classification model (with adapter)...")
    classification_model, classification_tokenizer = load(MODEL_PATH, adapter_path=ADAPTER_PATH)
    logger.info("Classification model loaded!")
    
    logger.info("Loading base model (no adapter)...")
    base_model, base_tokenizer = load(MODEL_PATH, adapter_path=None)
    logger.info("Base model loaded!")
    
    yield
    logger.info("Shutting down...")

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="Trace MLX Local Server",
    description="OpenAI-compatible API for Trace fine-tuned MLX models",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── System Prompts ────────────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "local-hermes-nemotron": CLASSIFICATION_SYSTEM_PROMPT,
    "local-hermes-base": ANALYSIS_SYSTEM_PROMPT,
}

def get_system_prompt(model_name: str) -> str:
    return SYSTEM_PROMPTS.get(model_name, CLASSIFICATION_SYSTEM_PROMPT)

# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "models": {
            "local-hermes-nemotron": f"{MODEL_PATH} + {ADAPTER_PATH}",
            "local-hermes-base": f"{MODEL_PATH} (base)"
        }
    }

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "local-hermes-nemotron",
                "object": "model",
                "created": 0,
                "owned_by": "trace-local",
                "permission": [],
                "root": "local-hermes-nemotron",
                "parent": None,
                "description": "Trace fine-tuned classification model with adapter"
            },
            {
                "id": "local-hermes-base",
                "object": "model",
                "created": 0,
                "owned_by": "trace-local",
                "permission": [],
                "root": "local-hermes-base",
                "parent": None,
                "description": "Base Qwen2.5-1.5B model for analysis/generation tasks"
            }
        ]
    }

def generate_with_model(model, tokenizer, prompt: str, request, stop_words: list, max_tokens: int):
    """Generate text using the specified model/tokenizer."""
    logger.info(f"generate_with_model called with tokenizer type: {type(tokenizer)}, has eos_token_id: {hasattr(tokenizer, 'eos_token_id')}")
    sampler = make_sampler(
        temp=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        min_p=request.min_p,
        xtc_probability=request.xtc_probability,
        xtc_threshold=request.xtc_threshold,
    )
    logits_processors = make_logits_processors(
        logit_bias=request.logit_bias,
        repetition_penalty=request.repetition_penalty,
        repetition_context_size=request.repetition_context_size,
    )
    output = generate(
        model=model,
        tokenizer=tokenizer,
        prompt=prompt,
        max_tokens=max_tokens,
        sampler=sampler,
        logits_processors=logits_processors,
        verbose=False,
    )
    for stop_word in stop_words:
        if output.endswith(stop_word):
            output = output[:-len(stop_word)]
            break
    return output

@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(request: ChatCompletionRequest):
    import time
    import uuid
    
    try:
        # Get model and tokenizer
        model, tokenizer = get_model_and_tokenizer(request.model)
        system_prompt = get_system_prompt(request.model)
        
        # Build prompt
        prompt = build_chat_prompt(request.messages, system_prompt, tokenizer)
        
        # Prepare arguments
        max_tokens = request.max_completion_tokens or request.max_tokens
        stop_words = request.stop or []
        
        # Generate
        output = generate_with_model(model, tokenizer, prompt, request, stop_words, max_tokens)
        
        # Token counts
        prompt_tokens = count_tokens(prompt, tokenizer)
        completion_tokens = count_tokens(output, tokenizer)
        
        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:29]}",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatChoice(
                    index=0,
                    message={"role": "assistant", "content": output},
                    finish_reason="stop"
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            )
        )
    except Exception as e:
        logger.error(f"Error in chat_completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/completions", response_model=CompletionResponse)
async def completions(request: CompletionRequest):
    import time
    import uuid
    
    try:
        model, tokenizer = get_model_and_tokenizer(request.model)
        system_prompt = get_system_prompt(request.model)
        
        max_tokens = request.max_completion_tokens or request.max_tokens
        stop_words = request.stop or []
        
        # For completions, we don't use chat template
        prompt = request.prompt
        
        output = generate_with_model(model, tokenizer, prompt, request, stop_words, max_tokens)
        
        prompt_tokens = count_tokens(prompt, tokenizer)
        completion_tokens = count_tokens(output, tokenizer)
        
        return CompletionResponse(
            id=f"cmpl-{uuid.uuid4().hex[:29]}",
            created=int(time.time()),
            model=request.model,
            choices=[
                CompletionChoice(
                    index=0,
                    text=output,
                    finish_reason="stop"
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            )
        )
    except Exception as e:
        logger.error(f"Error in completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")