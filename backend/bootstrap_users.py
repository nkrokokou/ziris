import hashlib
from datetime import datetime

from database import SessionLocal, User, init_db


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def upsert_user(username: str, password: str, role: str = "user", is_active: bool = True):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        hashed = sha256_hex(password)
        if user:
            user.hashed_password = hashed
            user.role = role
            user.is_active = is_active
            if not user.created_at:
                user.created_at = datetime.utcnow()
        else:
            user = User(
                username=username,
                hashed_password=hashed,
                role=role,
                is_active=is_active,
                created_at=datetime.utcnow(),
            )
            db.add(user)
        db.commit()
        print(f"OK: {username} => role={role}, active={is_active}")
    except Exception as e:
        db.rollback()
        print(f"ERROR for {username}: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Ensure tables and light migrations exist
    init_db()

    # Admin and demo
    upsert_user("admin", "admin", role="admin", is_active=True)
    upsert_user("demo", "demo", role="user", is_active=True)

    print("Done. Try logging in with admin/admin and demo/demo.")
