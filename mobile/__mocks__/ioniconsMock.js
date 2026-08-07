// Ionicons loads its font asynchronously, which triggers state updates outside of
// act() during tests. Render a plain view tagged with the icon name instead.
const React = require('react');
const { View } = require('react-native');

function Ionicons({ name, ...rest }) {
  return React.createElement(View, { accessibilityLabel: `icon-${name}`, ...rest });
}

module.exports = Ionicons;
module.exports.default = Ionicons;
