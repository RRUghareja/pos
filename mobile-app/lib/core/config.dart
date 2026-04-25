// Backend base URL. Android emulator: use 10.0.2.2 to reach host machine.
// iOS simulator / desktop: localhost works.
const String kApiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:4000',
);
