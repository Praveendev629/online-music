package expo.modules.soundwavenative

import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class SoundWaveModule : Module() {
  private val processCounter = AtomicLong(0)
  private var cookiesFilePath: String? = null

  // Dedicated workers so slow or hung yt-dlp processes never block the JS
  // bridge's serial queue (which would make the app look frozen on "searching").
  private val worker = Executors.newFixedThreadPool(2)

  override fun definition() = ModuleDefinition {
    Name("SoundWave")

    // Cheap warm-up: extract the bundled Python + yt-dlp binaries once, in the
    // background. Does NOT download anything, so it can never stall a search.
    AsyncFunction("warmUp") {
      runOnWorker {
        runCatching { ensureInitialized() }
      }
      true
    }

    // Stores a Netscape-format cookies.txt and passes `--cookies` to every call.
    AsyncFunction("setCookies") { cookies: String? ->
      if (cookies.isNullOrBlank()) {
        cookiesFilePath = null
        true
      } else {
        val file = File(currentContext().noBackupFilesDir, "youtube-cookies.txt")
        file.writeText(cookies.trim())
        cookiesFilePath = file.absolutePath
        true
      }
    }

    // Returns a directly playable stream URL. Tries m4a audio -> best audio ->
    // mp4 video (mp4 is always playable by ExoPlayer).
    AsyncFunction("extractAudio") { videoId: String ->
      runOnWorker {
        ensureInitialized()
        extractAudioUrl(videoId)
      }
    }

    // Searches YouTube; returns the same shape as the hosted /api/search endpoint.
    AsyncFunction("search") { query: String ->
      runOnWorker {
        ensureInitialized()
        searchVideos(query)
      }
    }

    // Optional manual refresh of the bundled yt-dlp to the latest STABLE build.
    // Not called automatically — only helps if playback starts being blocked.
    AsyncFunction("updateYtDlp") {
      runOnWorker {
        ensureInitialized()
        YoutubeDL.updateYoutubeDL(currentContext(), YoutubeDL.UpdateChannel.STABLE)
      }
      true
    }
  }

  private fun <T> runOnWorker(task: () -> T): T {
    val future: Future<T> = worker.submit(task)
    return try {
      future.get(200, TimeUnit.SECONDS)
    } catch (e: ExecutionException) {
      throw (e.cause ?: e)
    }
  }

  private fun currentContext() =
    appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private fun ensureInitialized() {
    // First call extracts the bundled Python + yt-dlp binaries; later calls are no-ops.
    YoutubeDL.init(currentContext())
  }

  private fun nextProcessId(prefix: String): String = "$prefix-${processCounter.incrementAndGet()}"

  private fun applyCookies(request: YoutubeDLRequest) {
    cookiesFilePath?.let { request.addOption("--cookies", it) }
  }

  private fun extractAudioUrl(videoId: String): String {
    val attempts = listOf("bestaudio[ext=m4a]", "bestaudio", "best[ext=mp4]")
    var lastError: Throwable? = null
    for (format in attempts) {
      try {
        val url = runGetUrl(videoId, format)
        if (url != null) return url
      } catch (e: Throwable) {
        lastError = e
      }
    }
    throw RuntimeException(
      "Failed to get a playable URL (${lastError?.message?.take(200) ?: "unknown error"})"
    )
  }

  private fun runGetUrl(videoId: String, format: String): String? {
    val request = YoutubeDLRequest("https://www.youtube.com/watch?v=$videoId")
    request.addOption("-f", format)
    request.addOption("--no-playlist")
    request.addOption("--no-warnings")
    request.addOption("--get-url")
    applyCookies(request)
    val response = YoutubeDL.execute(request, nextProcessId("extract"), null)
    return response.out
      .lineSequence()
      .map { it.trim() }
      .firstOrNull { it.startsWith("http") }
  }

  private fun searchVideos(query: String): List<Map<String, String>> {
    val request = YoutubeDLRequest("ytsearch5:$query")
    request.addOption("--flat-playlist")
    request.addOption("--no-warnings")
    request.addOption("-J")
    applyCookies(request)
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
        // flat-playlist entries carry almost no metadata, so the thumbnail is
        // always derived from the video id (fast + reliable).
        val thumbnail = entry.optString("thumbnail")
          .ifEmpty { "https://i.ytimg.com/vi/$id/hqdefault.jpg" }
        add(
          mapOf(
            "id" to id,
            "title" to entry.optString("title"),
            "author" to channel,
            "thumbnail" to thumbnail,
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