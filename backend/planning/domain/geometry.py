"""Simplify display geometry while sampling and scoring the full provider geometry."""

from math import cos, radians

from planning.domain.types import Coordinate


def simplify(coordinates: list[Coordinate], tolerance_m: float = 20) -> list[list[float]]:
    if len(coordinates) < 3:
        return [point.as_geojson() for point in coordinates]
    scale_x = 111_320 * cos(radians(coordinates[0].latitude))
    projected = [(point.longitude * scale_x, point.latitude * 111_320) for point in coordinates]
    keep = {0, len(coordinates) - 1}
    stack = [(0, len(coordinates) - 1)]
    while stack:
        start, end = stack.pop()
        x, y = projected[start]
        dx, dy = projected[end][0] - x, projected[end][1] - y
        length_squared = dx * dx + dy * dy
        largest, selected = tolerance_m * tolerance_m, None
        for index in range(start + 1, end):
            px, py = projected[index]
            ratio = (
                min(1, max(0, ((px - x) * dx + (py - y) * dy) / length_squared))
                if length_squared
                else 0
            )
            distance_squared = (px - x - ratio * dx) ** 2 + (py - y - ratio * dy) ** 2
            if distance_squared > largest:
                largest, selected = distance_squared, index
        if selected is not None:
            keep.add(selected)
            stack.extend([(start, selected), (selected, end)])
    return [coordinates[index].as_geojson() for index in sorted(keep)]
