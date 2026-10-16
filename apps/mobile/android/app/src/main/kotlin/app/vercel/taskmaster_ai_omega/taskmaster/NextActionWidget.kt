package app.vercel.taskmaster_ai_omega.taskmaster

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

// Home-screen widgets. The app writes their data after each Today load
// (lib/state/home_widget.dart) and handles the taskmaster:// links they open.

internal fun launch(context: Context, uri: String) =
    HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse(uri))

internal fun RemoteViews.showText(viewId: Int, text: String?) {
    if (text.isNullOrBlank()) {
        setViewVisibility(viewId, View.GONE)
    } else {
        setViewVisibility(viewId, View.VISIBLE)
        setTextViewText(viewId, text)
    }
}

internal fun RemoteViews.progress(data: SharedPreferences) {
    val done = data.getString("done", null)?.toIntOrNull() ?: 0
    val total = data.getString("total", null)?.toIntOrNull() ?: 0
    setProgressBar(R.id.widget_progress_bar, maxOf(total, 1), done, false)
}

/** "Today's tasks", 4x3: the next three planned tasks and progress. */
class NextActionWidget : HomeWidgetProvider() {
    private val rows = listOf(
        Row(R.id.t0_row, R.id.t0_title, R.id.t0_time, R.id.d1),
        Row(R.id.t1_row, R.id.t1_title, R.id.t1_time, R.id.d2),
        Row(R.id.t2_row, R.id.t2_title, R.id.t2_time, R.id.d3),
    )

    private data class Row(val row: Int, val title: Int, val time: Int, val dividerAfter: Int)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.next_action_widget).apply {
                setTextViewText(R.id.widget_date, widgetData.getString("date_label", "") ?: "")
                var shown = 0
                rows.forEachIndexed { i, r ->
                    val title = widgetData.getString("t${i}_title", null)
                    if (title.isNullOrBlank()) {
                        setViewVisibility(r.row, View.GONE)
                        setViewVisibility(r.dividerAfter, View.GONE)
                    } else {
                        shown++
                        setViewVisibility(r.row, View.VISIBLE)
                        setViewVisibility(r.dividerAfter, View.VISIBLE)
                        setTextViewText(r.title, title)
                        setTextViewText(r.time, widgetData.getString("t${i}_time", "") ?: "")
                        val taskId = widgetData.getString("t${i}_id", null)
                        setOnClickPendingIntent(
                            r.row,
                            launch(context, if (taskId != null) "taskmaster://task?id=$taskId" else "taskmaster://today"),
                        )
                    }
                }
                if (shown == 0) {
                    setViewVisibility(R.id.widget_empty, View.VISIBLE)
                    setTextViewText(
                        R.id.widget_empty,
                        widgetData.getString("empty_message", null) ?: "Plan your day with a Brain Dump",
                    )
                } else {
                    setViewVisibility(R.id.widget_empty, View.GONE)
                }
                showText(R.id.widget_progress, widgetData.getString("progress_label", null))
                progress(widgetData)
                setOnClickPendingIntent(R.id.widget_add, launch(context, "taskmaster://capture"))
                setOnClickPendingIntent(R.id.widget_calendar, launch(context, "taskmaster://today"))
                setOnClickPendingIntent(R.id.widget_root, launch(context, "taskmaster://today"))
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}

/** "Up next", 4x2: the next planned task or meeting, and progress. */
class UpNextWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.up_next_widget).apply {
                setTextViewText(
                    R.id.up_title,
                    widgetData.getString("up_title", null) ?: "Plan your day with a Brain Dump",
                )
                showText(R.id.up_detail, widgetData.getString("up_detail", null))
                progress(widgetData)
                val taskId = widgetData.getString("up_id", null)
                setOnClickPendingIntent(
                    R.id.up_row,
                    launch(context, if (taskId != null) "taskmaster://task?id=$taskId" else "taskmaster://today"),
                )
                setOnClickPendingIntent(R.id.widget_add, launch(context, "taskmaster://capture"))
                setOnClickPendingIntent(R.id.widget_open_tasks, launch(context, "taskmaster://tasks"))
                setOnClickPendingIntent(R.id.widget_root, launch(context, "taskmaster://today"))
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}

/** "Focus", 2x2: one tap into a focus session on the next task. */
class FocusWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.focus_widget).apply {
                setTextViewText(R.id.focus_time, widgetData.getString("focus_time", null) ?: "25:00")
                setTextViewText(
                    R.id.focus_caption,
                    widgetData.getString("focus_caption", null) ?: "Time to make progress.",
                )
                // Always into Focus: on the next task when there is one,
                // otherwise a plain timer. Start also starts the timer.
                val taskId = widgetData.getString("focus_task_id", null)
                val target = if (taskId != null) "taskmaster://focus?task=$taskId" else "taskmaster://focus"
                val sep = if (taskId != null) "&" else "?"
                setOnClickPendingIntent(R.id.focus_start, launch(context, "$target${sep}start=1"))
                setOnClickPendingIntent(R.id.widget_root, launch(context, target))
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
