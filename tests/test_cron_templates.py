"""Contract tests for cron_templates/generator.py"""
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from cron_templates.generator import TEMPLATES, generate_cron_script


class TestCronTemplatesGenerator:
    """Contract tests for cron_templates/generator.py"""

    def test_all_templates_defined(self):
        """All 6 expected templates should exist."""
        expected = [
            "telemetry_booster",
            "model_evaluator",
            "ci_health_check",
            "data_hydration",
            "perf_investigation",
            "security_hardening"
        ]
        for name in expected:
            assert name in TEMPLATES

    def test_template_structure(self):
        """Each template should have required fields."""
        for template in TEMPLATES.values():
            assert "schedule" in template
            assert "script" in template
            assert isinstance(template["script"], str)
            assert len(template["script"]) > 100  # meaningful script content

    def test_generate_cron_script_creates_file(self, temp_dir):
        """generate_cron_script should create executable script file."""
        spec = {
            "name": "test-telemetry-boost",
            "template": "telemetry_booster",
            "schedule": "0 * * * *",
            "args": ["--multiplier", "10", "--duration", "60"],
        }

        script_path = generate_cron_script(spec)

        assert script_path.exists()
        assert script_path.is_file()

        # Check content
        content = script_path.read_text()
        assert "#!/usr/bin/env python3" in content
        assert "asyncio" in content
        assert "aiohttp" in content

        # Check executable
        import stat
        assert script_path.stat().st_mode & stat.S_IXUSR

    def test_generate_all_templates(self, temp_dir):
        """Generate script for each template."""
        for name in TEMPLATES:
            spec = {
                "name": f"test-{name}",
                "template": name,
                "schedule": "0 * * * *",
            }
            script_path = generate_cron_script(spec)
            assert script_path.exists()
            content = script_path.read_text()
            assert len(content) > 0
            # Clean up
            script_path.unlink()

    def test_script_content_validity(self, temp_dir):
        """Generated script should be valid Python."""
        spec = {
            "name": "test-syntax",
            "template": "telemetry_booster",
            "schedule": "0 * * * *",
        }

        script_path = generate_cron_script(spec)

        # Compile to check syntax
        import py_compile
        py_compile.compile(str(script_path), doraise=True)

        script_path.unlink()

    def test_template_mappings_correct(self):
        """Each template should have correct base schedule."""
        # All templates use standard cron format
        for name, template in TEMPLATES.items():
            schedule = template["schedule"]
            # Should be 5-field cron (not quartz)
            parts = schedule.split()
            assert len(parts) == 5, f"{name} schedule should be 5-field cron: {schedule}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])