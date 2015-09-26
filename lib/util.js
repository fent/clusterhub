/**
 * Shortcut to check if a property exists in an object.
 *
 * @param (Object) obj
 * @param (String) key
 * @return (Boolean)
 */
exports.has = function(obj, key) {
  return Object.hasOwnProperty.call(obj, key);
};
