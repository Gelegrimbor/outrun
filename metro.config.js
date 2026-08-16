// Extends Expo's default Metro config (replacing it wholesale would break
// expo-router). The extra asset extensions are for the GLTF character/zombie
// models that replace the placeholder shapes in a later phase.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf');

module.exports = config;
