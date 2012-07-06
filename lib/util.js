/**
 * Shortcut to check if a property exists in an object.
 *
 * @param (Object) obj
 * @param (string) key
 * @return (boolean)
 */
exports.has = function(obj, key) {
  return Object.hasOwnProperty.call(obj, key);
}
