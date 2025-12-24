import httpx
import logging
from typing import Optional
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

CLERK_API_URL = "https://api.clerk.com/v1"

async def get_user_id_by_email(email: str) -> Optional[str]:
    """
    Resolve a Clerk User ID by email address using Clerk's Management API.
    Requires CLERK_SECRET_KEY in environment.
    """
    secret_key = getattr(settings, "clerk_secret_key", None)
    print(f"DEBUG: get_user_id_by_email - email={email}, secret_key_present={bool(secret_key)}")
    if not secret_key:
        logger.error("CLERK_SECRET_KEY not configured in settings")
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CLERK_API_URL}/users",
                params={"email_address": [email]},
                headers={"Authorization": f"Bearer {secret_key}"}
            )
            print(f"DEBUG: Clerk API status={response.status_code}, response={response.text}")
            
            if response.status_code != 200:
                logger.error(f"Clerk API error: {response.status_code} - {response.text}")
                return None
            
            users = response.json()
            if users and len(users) > 0:
                # Return the first matching user's ID
                return users[0].get("id")
            
            return None
    except Exception as e:
        logger.exception(f"Failed to resolve user ID for email {email}: {e}")
        return None
