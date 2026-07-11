"""Application configuration loaded from environment."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

PUBLIC_ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI providers (all required)
    venice_api_key: str = ""
    openai_api_key: str = ""
    venice_base_url: str = "https://api.venice.ai/api/v1"
    venice_model: str = "zai-org-glm-5-1"
    openai_model: str = "gpt-4.1"

    # Web intelligence (required)
    tinyfish_api_key: str = ""

    # Wallet / accounts (all required)
    magic_secret_key: str = ""
    magic_publishable_key: str = ""
    particle_project_id: str = ""
    particle_client_key: str = ""
    particle_app_id: str = ""
    zerodev_project_id: str = ""
    zerodev_rpc_url: str = ""
    zerodev_bundler_url: str = ""
    zerodev_paymaster_url: str = ""
    google_client_id: str = ""

    # Chain (dedicated RPC required — no public endpoint)
    arbitrum_rpc: str = PUBLIC_ARBITRUM_RPC
    arbitrum_chain_id: int = 42161

    # x402 (required)
    x402_facilitator_url: str = "https://facilitator.payai.network"
    agent_wallet_private_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./axis.db"

    # App
    port: int = 8000
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    environment: Literal["development", "staging", "production", "testing"] = "development"
    rate_limit_per_minute: int = 30
    max_x402_spend_usdc_per_day: float = 0.10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_provider(self) -> Literal["venice", "openai"]:
        return "venice" if self.venice_api_key else "openai"

    @property
    def effective_zerodev_bundler(self) -> str:
        return self.zerodev_bundler_url or self.zerodev_rpc_url

    @property
    def effective_zerodev_paymaster(self) -> str:
        return self.zerodev_paymaster_url or self.zerodev_rpc_url

    @property
    def wallet_configured(self) -> bool:
        return bool(
            self.magic_secret_key
            and self.magic_publishable_key
            and self.particle_project_id
            and self.particle_client_key
            and self.particle_app_id
            and self.google_client_id
        )

    @property
    def zerodev_configured(self) -> bool:
        return bool(self.zerodev_project_id and self.effective_zerodev_bundler)

    @property
    def chain_configured(self) -> bool:
        rpc = self.arbitrum_rpc.strip().rstrip("/")
        return rpc != PUBLIC_ARBITRUM_RPC.rstrip("/") and len(rpc) > 20

    @property
    def intelligence_configured(self) -> bool:
        return bool(self.tinyfish_api_key and self.agent_wallet_private_key)

    @property
    def fully_configured(self) -> bool:
        return len(self.missing_required()) == 0

    def missing_required(self) -> list[str]:
        """Return env var names that are missing or invalid."""
        if self.environment == "testing":
            return []

        checks: list[tuple[str, bool]] = [
            ("VENICE_API_KEY", bool(self.venice_api_key.strip())),
            ("OPENAI_API_KEY", bool(self.openai_api_key.strip())),
            ("TINYFISH_API_KEY", bool(self.tinyfish_api_key.strip())),
            ("MAGIC_SECRET_KEY", bool(self.magic_secret_key.strip())),
            ("MAGIC_PUBLISHABLE_KEY", bool(self.magic_publishable_key.strip())),
            ("PARTICLE_PROJECT_ID", bool(self.particle_project_id.strip())),
            ("PARTICLE_CLIENT_KEY", bool(self.particle_client_key.strip())),
            ("PARTICLE_APP_ID", bool(self.particle_app_id.strip())),
            ("ZERODEV_PROJECT_ID", bool(self.zerodev_project_id.strip())),
            ("ZERODEV_RPC_URL", bool(self.zerodev_rpc_url.strip())),
            ("GOOGLE_CLIENT_ID", bool(self.google_client_id.strip())),
            ("AGENT_WALLET_PRIVATE_KEY", bool(self.agent_wallet_private_key.strip())),
            ("X402_FACILITATOR_URL", bool(self.x402_facilitator_url.strip())),
            ("ARBITRUM_RPC", self.chain_configured),
        ]
        return [name for name, ok in checks if not ok]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_startup_config() -> None:
    """Fail fast when required production keys are missing."""
    settings = get_settings()
    if settings.environment == "testing":
        return
    missing = settings.missing_required()
    if missing:
        raise RuntimeError(
            "AXIS backend requires all API keys. Missing or invalid: "
            + ", ".join(missing)
            + ". See docs/KEYS_SETUP.md"
        )
