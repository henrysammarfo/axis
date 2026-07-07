"""Application configuration loaded from environment."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI providers
    venice_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    venice_base_url: str = "https://api.venice.ai/api/v1"
    venice_model: str = "zai-org-glm-5-1"
    openai_model: str = "gpt-4.1"
    anthropic_model: str = "claude-sonnet-4-6"

    # Web intelligence
    tinyfish_api_key: str = ""

    # Wallet / accounts
    magic_secret_key: str = ""
    magic_publishable_key: str = ""
    particle_project_id: str = ""
    particle_client_key: str = ""
    particle_app_id: str = ""
    zerodev_project_id: str = ""
    zerodev_bundler_url: str = ""
    zerodev_paymaster_url: str = ""
    google_client_id: str = ""

    # Chain
    arbitrum_rpc: str = "https://arb1.arbitrum.io/rpc"
    arbitrum_chain_id: int = 42161

    # x402
    x402_facilitator_url: str = "https://facilitator.payai.network"
    agent_wallet_private_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./axis.db"

    # App
    port: int = 8000
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    environment: Literal["development", "staging", "production"] = "development"
    rate_limit_per_minute: int = 30
    max_x402_spend_usdc_per_day: float = 0.10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_provider(self) -> Literal["venice", "openai", "anthropic", "rules"]:
        if self.venice_api_key:
            return "venice"
        if self.openai_api_key:
            return "openai"
        if self.anthropic_api_key:
            return "anthropic"
        return "rules"

    @property
    def wallet_configured(self) -> bool:
        return bool(
            self.magic_secret_key
            and self.particle_project_id
            and self.particle_client_key
            and self.particle_app_id
        )

    @property
    def zerodev_configured(self) -> bool:
        return bool(self.zerodev_project_id and self.zerodev_bundler_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
