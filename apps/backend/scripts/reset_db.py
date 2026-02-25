from db.models import Base
from db.database import engine

# Drop all tables
Base.metadata.drop_all(bind=engine)
print("All tables dropped.")

# Recreate all tables
Base.metadata.create_all(bind=engine)
print("All tables recreated.")
