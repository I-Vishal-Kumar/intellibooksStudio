"""
FastAPI Authentication Middleware for Clerk
"""

from typing import Optional, List, Callable, Any
from functools import wraps
import httpx
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from jwt import PyJWKClient
import os


class User(BaseModel):
    """Authenticated user model."""

    id: str
    clerk_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    organization_id: Optional[str] = None
    metadata: dict = {}


class AuthContext(BaseModel):
    """Authentication context."""

    user: Optional[User] = None
    is_authenticated: bool = False
    session_id: Optional[str] = None


class ClerkAuth:
    """Clerk authentication handler for FastAPI."""

    def __init__(
        self,
        secret_key: Optional[str] = None,
        publishable_key: Optional[str] = None,
        jwks_url: Optional[str] = None,
    ):
        self.secret_key = secret_key or os.getenv("CLERK_SECRET_KEY")
        self.publishable_key = publishable_key or os.getenv("CLERK_PUBLISHABLE_KEY")

        if not self.secret_key:
            raise ValueError("CLERK_SECRET_KEY is required")

        # Extract instance ID from publishable key for JWKS URL
        if self.publishable_key:
            # Format: pk_test_xxx or pk_live_xxx
            parts = self.publishable_key.split("_")
            if len(parts) >= 3:
                instance_id = parts[2][:24]  # First 24 chars after pk_test_/pk_live_
                self.jwks_url = jwks_url or f"https://{instance_id}.clerk.accounts.dev/.well-known/jwks.json"
            else:
                self.jwks_url = jwks_url
        else:
            self.jwks_url = jwks_url

        self._jwks_client: Optional[PyJWKClient] = None
        self._http_client = httpx.AsyncClient(
            base_url="https://api.clerk.com/v1",
            headers={"Authorization": f"Bearer {self.secret_key}"},
        )

    @property
    def jwks_client(self) -> Optional[PyJWKClient]:
        """Lazy-load JWKS client."""
        if self._jwks_client is None and self.jwks_url:
            self._jwks_client = PyJWKClient(self.jwks_url)
        return self._jwks_client

    async def verify_token(self, token: str) -> Optional[User]:
        """Verify a JWT token and return the user."""
        try:
            # Try to verify with JWKS first
            if self.jwks_client:
                signing_key = self.jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                )
            else:
                # Fallback to secret key verification
                payload = jwt.decode(
                    token,
                    self.secret_key,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )

            user_id = payload.get("sub")
            if not user_id:
                return None

            # Fetch full user data from Clerk API
            return await self.get_user(user_id)

        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    async def get_user(self, user_id: str) -> Optional[User]:
        """Fetch user data from Clerk API."""
        try:
            response = await self._http_client.get(f"/users/{user_id}")

            if response.status_code != 200:
                return None

            data = response.json()

            # Extract email
            email = ""
            if data.get("email_addresses"):
                primary_email = next(
                    (e for e in data["email_addresses"] if e.get("id") == data.get("primary_email_address_id")),
                    data["email_addresses"][0] if data["email_addresses"] else None,
                )
                if primary_email:
                    email = primary_email.get("email_address", "")

            # Extract roles and permissions from metadata
            public_metadata = data.get("public_metadata", {})
            roles = public_metadata.get("roles", ["user"])
            permissions = public_metadata.get("permissions", [])
            organization_id = public_metadata.get("organization_id")

            return User(
                id=data["id"],
                clerk_id=data["id"],
                email=email,
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                image_url=data.get("image_url"),
                roles=roles if isinstance(roles, list) else [roles],
                permissions=permissions if isinstance(permissions, list) else [],
                organization_id=organization_id,
                metadata=data.get("private_metadata", {}),
            )

        except Exception:
            return None

    async def close(self):
        """Close HTTP client."""
        await self._http_client.aclose()


# Global auth instance
_auth_instance: Optional[ClerkAuth] = None


def get_auth() -> ClerkAuth:
    """Get or create the global auth instance."""
    global _auth_instance
    if _auth_instance is None:
        _auth_instance = ClerkAuth()
    return _auth_instance


# Security scheme
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[User]:
    """Dependency to get the current authenticated user."""
    if not credentials:
        return None

    auth = get_auth()
    return await auth.verify_token(credentials.credentials)


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> User:
    """Dependency that requires authentication."""
    auth = get_auth()
    user = await auth.verify_token(credentials.credentials)

    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    return user


def require_roles(*roles: str):
    """Dependency factory that requires specific roles."""

    async def check_roles(user: User = Depends(require_auth)) -> User:
        user_roles = set(user.roles)
        required_roles = set(roles)

        if not user_roles.intersection(required_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Required roles: {', '.join(roles)}",
            )

        return user

    return check_roles


def require_permissions(*permissions: str):
    """Dependency factory that requires specific permissions."""

    async def check_permissions(user: User = Depends(require_auth)) -> User:
        user_permissions = set(user.permissions)

        # Check for wildcard
        if "*" in user_permissions or "*:*" in user_permissions:
            return user

        for perm in permissions:
            if perm not in user_permissions:
                # Check for wildcard on resource
                resource = perm.split(":")[0] if ":" in perm else perm
                if f"{resource}:*" not in user_permissions:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Missing permission: {perm}",
                    )

        return user

    return check_permissions


def require_organization(org_id_param: str = "organization_id"):
    """Dependency factory that requires organization membership."""

    async def check_organization(
        request: Request,
        user: User = Depends(require_auth),
    ) -> User:
        # Try to get org ID from path, query, or body
        org_id = (
            request.path_params.get(org_id_param)
            or request.query_params.get(org_id_param)
        )

        if not org_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        if user.organization_id != org_id:
            raise HTTPException(
                status_code=403,
                detail="Not a member of this organization",
            )

        return user

    return check_organization
