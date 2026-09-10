package expo.modules.soundwavenative

import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

class SoundWaveModule : Module() {
  private val processCounter = AtomicLong(0)

  override fun definition() = ModuleDefinition {
    Name("SoundWave")

    // Returns a directly playable audio URL (streamed, nothing written to disk)
    // for the given YouTube id. youtube-dl / yt-dlp runs fully on-device.
    AsyncFunction("extractAudio") { videoId: String ->
      ensureInitialized()
      extractAudioUrl(videoId)
    }

    // Searches YouTube. Returns the same shape as the hosted /api/search endpoint.
    AsyncFunction("search") { query: String ->
      ensureInitialized()
      searchVideos(query)
    }
  }

  private fun ensureInitialized() {
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context is not available")
    // First call extracts the bundled Python + yt-dlp; subsequent calls are no-ops.
    YoutubeDL.init(context)
  }

  private fun nextProcessId(prefix: String): String = "$prefix-${processCounter.incrementAndGet()}"

  private fun extractAudioUrl(videoId: String): String {
    return runGetUrl(videoId, "bestaudio[ext=m4a]")
      ?: runGetUrl(videoId, "bestaudio")
      ?: throw RuntimeException("yt-dlp returned no playable audio URL")
  }

  private fun runGetUrl(videoId: String, format: String): String? {
    val request = YoutubeDLRequest("https://www.youtube.com/watch?v=$videoId")
    request.addOption("-f", format)
    request.addOption("--no-playlist")
    request.addOption("--no-warnings")
    request.addOption("--get-url")
    return try {
      val response = YoutubeDL.execute(request, nextProcessId("extract"), null)
      response.out
        .lineSequence()
        .map { it.trim() }
        .firstOrNull { it.startsWith("http") }
    } catch (e: Throwable) {
      // fall back to the next format attempt
      null
    }
  }

  private fun searchVideos(query: String): List<Map<String, String>> {
    val request = YoutubeDLRequest("ytsearch5:$query")
    request.addOption("--flat-playlist")
    request.addOption("--no-warnings")
    request.addOption("-J")
    val response = YoutubeDL.execute(request, nextProcessId("search"), null)
    val out = response.out.trim()
    if (out.isEmpty()) {
      val err = response.err.trim()
      throw RuntimeException(
        if (err.isEmpty()) "No search results" else "Search failed: ${err.lineSequence().lastOrNull().orEmpty()}"
      )
    }
    return parseSearchJson(out)
  }

  private fun parseSearchJson(output: String): List<Map<String, String>> {
    val root = JSONObject(output)
    val entries = root.optJSONArray("entries") ?: return emptyList()
    return buildList {
      for (i in 0 until entries.length()) {
        val entry = entries.optJSONObject(i) ?: continue
        val id = entry.optString("id")
        if (id.isEmpty()) continue
        val channel = entry.optString("channel").ifEmpty { entry.optString("uploader") }
        add(
          mapOf(
            "id" to id,
            "title" to entry.optString("title"),
            "author" to channel,
            "thumbnail" to entry.optString("thumbnail"),
            "duration" to formatDuration(entry.optInt("duration", 0)),
            "views" to entry.optString("view_count", "0")
          )
        )
      }
    }
  }

  private fun formatDuration(seconds: Int): String {
    if (seconds <= 0) return "0:00"
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) {
      "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    } else {
      "$m:${s.toString().padStart(2, '0')}"
    }
  }
}