import SwiftUI

/// A notebook on the shelf. Holds ordered pages; drawing strokes for each
/// page are stored separately on disk keyed by the page id.
struct Journal: Identifiable, Codable, Hashable {
    var id: UUID
    var title: String
    var cover: CoverStyle
    var createdAt: Date
    var pages: [JournalPage]

    init(id: UUID = UUID(),
         title: String,
         cover: CoverStyle = .sage,
         createdAt: Date = Date(),
         pages: [JournalPage] = []) {
        self.id = id
        self.title = title
        self.cover = cover
        self.createdAt = createdAt
        self.pages = pages
    }

    /// A starter journal seeded on first launch.
    static func sample() -> Journal {
        Journal(
            title: "My Life Journal",
            cover: .sage,
            pages: [
                JournalPage(template: .cover),
                JournalPage(template: .soap),
                JournalPage(template: .sermonNotes),
                JournalPage(template: .prayerList),
                JournalPage(template: .dailyPlanner)
            ]
        )
    }
}

/// A single page inside a journal. The visual layout comes from `template`;
/// the user's handwriting is persisted as PencilKit drawing data on disk.
struct JournalPage: Identifiable, Codable, Hashable {
    var id: UUID
    var template: PageTemplate
    var createdAt: Date

    init(id: UUID = UUID(), template: PageTemplate, createdAt: Date = Date()) {
        self.id = id
        self.template = template
        self.createdAt = createdAt
    }
}

/// Cover look for a journal — a color theme paired with an opening verse.
enum CoverStyle: String, Codable, CaseIterable, Identifiable {
    case sage
    case navy
    case terracotta
    case plum
    case charcoal
    case gold

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .sage:        return "Sage"
        case .navy:        return "Navy"
        case .terracotta:  return "Terracotta"
        case .plum:        return "Plum"
        case .charcoal:    return "Charcoal"
        case .gold:        return "Gold"
        }
    }

    var primary: Color {
        switch self {
        case .sage:        return Color(red: 0.42, green: 0.52, blue: 0.45)
        case .navy:        return Color(red: 0.16, green: 0.24, blue: 0.38)
        case .terracotta:  return Color(red: 0.74, green: 0.43, blue: 0.34)
        case .plum:        return Color(red: 0.40, green: 0.28, blue: 0.42)
        case .charcoal:    return Color(red: 0.22, green: 0.24, blue: 0.27)
        case .gold:        return Color(red: 0.70, green: 0.56, blue: 0.27)
        }
    }

    /// A softer tint used for the cover gradient.
    var secondary: Color {
        primary.opacity(0.78)
    }

    /// Foil/accent color for cover lettering and rule.
    var foil: Color {
        switch self {
        case .gold:        return Color(red: 0.98, green: 0.91, blue: 0.74)
        default:           return Color.white.opacity(0.92)
        }
    }

    /// Opening scripture printed on the cover.
    var scripture: String {
        switch self {
        case .sage:
            return "“This is the day the Lord has made; let us rejoice and be glad in it.”  — Psalm 118:24"
        case .navy:
            return "“Your word is a lamp to my feet and a light to my path.”  — Psalm 119:105"
        case .terracotta:
            return "“For I know the plans I have for you, declares the Lord.”  — Jeremiah 29:11"
        case .plum:
            return "“Be still, and know that I am God.”  — Psalm 46:10"
        case .charcoal:
            return "“The steadfast love of the Lord never ceases; his mercies are new every morning.”  — Lamentations 3:22–23"
        case .gold:
            return "“Trust in the Lord with all your heart.”  — Proverbs 3:5"
        }
    }
}
