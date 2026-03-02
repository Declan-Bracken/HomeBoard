from db.schemas import HoldCreate

def prediction_to_hold(prediction: dict) -> HoldCreate:
    x_center = int(prediction["x"])
    y_center = int(prediction["y"])
    width = prediction["width"]
    height = prediction["height"]

    x_min = int(x_center - width / 2)
    x_max = int(x_center + width / 2)
    y_min = int(y_center - height / 2)
    y_max = int(y_center + height / 2)

    polygon = [
        {"x": int(point["x"]), "y": int(point["y"])}
        for point in prediction.get("points", [])
    ]

    return HoldCreate(
        x_min=x_min,
        x_max=x_max,
        y_min=y_min,
        y_max=y_max,
        x_center=x_center,
        y_center=y_center,
        confidence=float(prediction["confidence"]),
        polygon=polygon
    )
