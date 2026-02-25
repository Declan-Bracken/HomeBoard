from db.models import Wall, Route, Hold
from db.database import SessionLocal

db = SessionLocal()

wall = Wall(name="home wall2", image_url="image1.png", created_by="dbracken")
# db.add(wall)
# db.commit()
# db.refresh(wall)

route = Route(name="warmup problem", wall_id = wall.id, grade = "V2", created_by="dbracken")
# db.add(route)
# db.commit()
# db.refresh(route)

hold = Hold(wall_id = wall.id,
    x_min=0,
    x_max=10,
    y_min=0,
    y_max = 10,
    x_center= 5,
    y_center= 5,
    confidence= 95,
    polygon= [[0,0],[0,10],[10,10],[10,0]]
    )
# db.add(hold)
# db.commit()
# db.refresh(hold)

print(wall.routes)   # should include Test Route
print(wall.holds)    # should include Test Hold
print(route.wall) # should be empty until you assign holds
