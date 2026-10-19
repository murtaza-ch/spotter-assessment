class ProviderError(Exception):
    """A safe message for a failed upstream request. Never include credential-bearing URLs."""

    def __init__(self, message: str, *, code: str = "provider_unavailable", status_code: int = 502):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)
