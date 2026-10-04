# Data model

No new persistent records. `dentist_directory` is a transient response with `status`, `message`, and `offices`, where `offices` is the existing sample office card array. The request context is the existing signed session UID; saved company and ZIP come from that user's profile. The chat log stores a bot message containing the directory result for the current browser session.
