import SwiftUI

/// The set of page layouts a journal page can use.
/// These mirror the Life Journal printed planner plus a few
/// classic Christian journaling formats (S.O.A.P., prayer, gratitude).
enum PageTemplate: String, Codable, CaseIterable, Identifiable {
    case cover
    case soap            // Scripture / Observation / Application / Prayer
    case sermonNotes
    case prayerList
    case gratitude
    case dailyPlanner
    case weeklyTop3
    case weeklySchedule
    case monthlyCalendar
    case notesTasks
    case lined
    case dotted
    case blank

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .cover:            return "Cover"
        case .soap:             return "Daily Devotion (S.O.A.P.)"
        case .sermonNotes:      return "Sermon Notes"
        case .prayerList:       return "Prayer List"
        case .gratitude:        return "Gratitude"
        case .dailyPlanner:     return "Daily Planner"
        case .weeklyTop3:       return "Weekly Top 3"
        case .weeklySchedule:   return "Weekly Schedule"
        case .monthlyCalendar:  return "Monthly Calendar"
        case .notesTasks:       return "Notes / Tasks"
        case .lined:            return "Lined"
        case .dotted:           return "Dotted"
        case .blank:            return "Blank"
        }
    }

    var subtitle: String {
        switch self {
        case .cover:            return "Journal cover page"
        case .soap:             return "Scripture · Observation · Application · Prayer"
        case .sermonNotes:      return "Capture the message and how to apply it"
        case .prayerList:       return "Requests and answered prayers"
        case .gratitude:        return "Count today's blessings"
        case .dailyPlanner:     return "Schedule, priorities, and tasks"
        case .weeklyTop3:       return "Three tasks that must be done this week"
        case .weeklySchedule:   return "A week at a glance"
        case .monthlyCalendar:  return "A full month grid"
        case .notesTasks:       return "Open notes with a task column"
        case .lined:            return "Ruled writing lines"
        case .dotted:           return "Dot grid for free-form layout"
        case .blank:            return "A clean blank page"
        }
    }

    var systemImage: String {
        switch self {
        case .cover:            return "book.closed"
        case .soap:             return "book"
        case .sermonNotes:      return "mic"
        case .prayerList:       return "hands.sparkles"
        case .gratitude:        return "heart"
        case .dailyPlanner:     return "calendar.day.timeline.left"
        case .weeklyTop3:       return "list.number"
        case .weeklySchedule:   return "calendar"
        case .monthlyCalendar:  return "calendar.badge.clock"
        case .notesTasks:       return "checklist"
        case .lined:            return "text.alignleft"
        case .dotted:           return "circle.grid.3x3"
        case .blank:            return "rectangle"
        }
    }

    /// Templates offered when adding a new page (cover excluded — it's auto-created).
    static var insertable: [PageTemplate] {
        [.soap, .sermonNotes, .prayerList, .gratitude, .dailyPlanner,
         .weeklyTop3, .weeklySchedule, .monthlyCalendar, .notesTasks,
         .lined, .dotted, .blank]
    }
}
