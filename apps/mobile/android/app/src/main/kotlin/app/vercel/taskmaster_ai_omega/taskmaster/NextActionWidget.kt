package app.vercel.taskmaster_ai_omega.taskmaster

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Home-screen widget: the Next Best Action and today's progress. The app
 * writes these after each Today load (lib/state/home_widget.dart); tapping
 * the widget opens the app.
 */
class NextActionWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        val title = widgetData.getString("next_title", null)
        val detail = widgetData.getString("next_detail", null)
        val progress = widgetData.getString("progress", null)
        val kicker = widgetData.getString("kicker", null) ?: "NEXT BEST ACTION"
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.next_action_widget).apply {
                setTextViewText(R.id.widget_kicker, kicker)
                setTextViewText(
                    R.id.widget_title,
                    title ?: "Open TaskMasterAi to plan your day",
                )
                if (detail.isNullOrBlank()) {
                    setViewVisibility(R.id.widget_detail, View.GONE)
                } else {
                    setViewVisibility(R.id.widget_detail, View.VISIBLE)
                    setTextViewText(R.id.widget_detail, detail)
                }
                setTextViewText(R.id.widget_progress, progress ?: "")
                setOnClickPendingIntent(
                    R.id.widget_root,
                    HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java),
                )
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
