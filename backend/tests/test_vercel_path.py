from vercel_path import unwrap_vercel_path


def test_unwrap_root_health_and_double_api_prefix():
    assert unwrap_vercel_path("/api") == "/"
    assert unwrap_vercel_path("/api/") == "/"
    assert unwrap_vercel_path("/api/health") == "/health"
    assert unwrap_vercel_path("/api/config/status") == "/config/status"
    assert unwrap_vercel_path("/api/api/auth/verify") == "/api/auth/verify"
    assert unwrap_vercel_path("/api/api/agent/status/u") == "/api/agent/status/u"
    assert unwrap_vercel_path("/api/auth/verify") == "/api/auth/verify"
    assert unwrap_vercel_path("/health") == "/health"
