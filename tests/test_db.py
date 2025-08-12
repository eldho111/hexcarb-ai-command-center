import importlib
import os
import sys

sys.path.append(os.getcwd())

sqlmodel = importlib.util.find_spec("sqlmodel")
if sqlmodel is None:
    import pytest
    pytest.skip("sqlmodel not installed", allow_module_level=True)


def test_database_url_override(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    db_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    module = importlib.import_module("api.db")
    importlib.reload(module)
    assert str(module.engine.url) == db_url
