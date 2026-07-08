import SwiftUI

/// Shared sizing and colors for page templates and chrome.
enum LJTheme {
    /// Canonical page size everything is laid out and drawn against.
    /// Roughly US-Letter proportions (8.5 × 11). Keeping it fixed means
    /// handwriting stays aligned to the template across launches.
    static let pageSize = CGSize(width: 1024, height: 1325)

    /// Standard inner margin for template content.
    static let margin: CGFloat = 72

    // Ink / paper palette
    static let ink       = Color(red: 0.16, green: 0.18, blue: 0.22)
    static let softInk   = Color(red: 0.42, green: 0.45, blue: 0.50)
    static let rule      = Color(red: 0.80, green: 0.82, blue: 0.86)
    static let faint     = Color(red: 0.88, green: 0.90, blue: 0.93)
    static let paper     = Color.white
    static let accent    = Color(red: 0.710, green: 0.384, blue: 0.247)
    static let shelf     = Color(red: 0.95, green: 0.94, blue: 0.91)
}
