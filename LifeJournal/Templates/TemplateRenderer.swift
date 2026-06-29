import SwiftUI
import PencilKit
import UIKit

/// Rasterizes a page template (and, optionally, the handwriting on top) to a
/// `UIImage`. Shared by the live editor background, thumbnails, and PDF export
/// so every surface renders pages identically.
enum TemplateRenderer {
    /// The printed template for a page, without handwriting.
    @MainActor
    static func templateImage(for page: JournalPage, in journal: Journal, scale: CGFloat) -> UIImage? {
        let view = TemplateBackground(
            template: page.template,
            coverTitle: journal.title,
            coverScripture: journal.cover.scripture,
            coverStyle: journal.cover
        )
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        return renderer.uiImage
    }

    /// A fully composited page: template with the handwriting drawn over it.
    @MainActor
    static func compositeImage(for page: JournalPage,
                               in journal: Journal,
                               drawing: PKDrawing,
                               scale: CGFloat) -> UIImage {
        let pageRect = CGRect(origin: .zero, size: LJTheme.pageSize)
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: LJTheme.pageSize, format: format)
        return renderer.image { _ in
            UIColor.white.setFill()
            UIRectFill(pageRect)
            templateImage(for: page, in: journal, scale: scale)?.draw(in: pageRect)
            if !drawing.bounds.isEmpty {
                drawing.image(from: pageRect, scale: scale).draw(in: pageRect)
            }
        }
    }
}
