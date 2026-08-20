export type ValueConflict = { base: unknown; local: unknown; remote: unknown };
export type MergeConflicts = Record<string, ValueConflict>;

const equal = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null || typeof left !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  const leftObject = left as Record<string, unknown>, rightObject = right as Record<string, unknown>;
  const keys = Object.keys(leftObject);
  return keys.length === Object.keys(rightObject).length && keys.every((key) => Object.prototype.hasOwnProperty.call(rightObject, key) && equal(leftObject[key], rightObject[key]));
};

export function threeWayMerge<T extends Record<string, unknown>>(base: T, local: T, remote: T): { merged: T; conflicts: MergeConflicts } {
  const merged: Record<string, unknown> = {};
  const conflicts: MergeConflicts = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  keys.forEach((key) => {
    const baseValue = base[key], localValue = local[key], remoteValue = remote[key];
    if (equal(localValue, remoteValue)) merged[key] = localValue;
    else if (equal(localValue, baseValue)) merged[key] = remoteValue;
    else if (equal(remoteValue, baseValue)) merged[key] = localValue;
    else { merged[key] = localValue; conflicts[key] = { base: baseValue, local: localValue, remote: remoteValue }; }
  });
  return { merged: merged as T, conflicts };
}
