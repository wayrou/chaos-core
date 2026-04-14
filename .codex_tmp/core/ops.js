export function getCurrentOperation(state) {
    return state.operation;
}
export function getCurrentFloor(operation) {
    if (!operation)
        return null;
    return operation.floors[operation.currentFloorIndex] ?? null;
}
export function getCurrentRoom(operation) {
    if (!operation)
        return null;
    const floor = getCurrentFloor(operation);
    if (!floor || !operation.currentRoomId)
        return null;
    const floorNodes = floor.nodes ?? floor.rooms ?? [];
    return floorNodes.find((n) => n.id === operation.currentRoomId) ?? null;
}
