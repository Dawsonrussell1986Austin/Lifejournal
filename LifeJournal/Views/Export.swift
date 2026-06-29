import SwiftUI
import PencilKit
import UIKit

/// A generated PDF ready to share. `Identifiable` so it can drive `.sheet(item:)`.
struct ExportedPDF: Identifiable {
    let id = UUID()
    let url: URL
}

enum PDFExporter {
    /// Renders every page of a journal (template + handwriting) into a
    /// multi-page PDF in the temporary directory and returns its URL.
    @MainActor
    static func export(journal: Journal, store: JournalStore) -> ExportedPDF? {
        let pageRect = CGRect(origin: .zero, size: LJTheme.pageSize)
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: journal.title,
            kCGPDFContextCreator as String: "Life Journal"
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        let fileName = sanitizedFileName(journal.title) + ".pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try renderer.writePDF(to: url) { ctx in
                for page in journal.pages {
                    ctx.beginPage()
                    let drawing = store.loadDrawing(page.id)
                    let image = TemplateRenderer.compositeImage(
                        for: page, in: journal, drawing: drawing, scale: 2
                    )
                    image.draw(in: pageRect)
                }
            }
            return ExportedPDF(url: url)
        } catch {
            print("LifeJournal: PDF export failed — \(error)")
            return nil
        }
    }

    private static func sanitizedFileName(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = trimmed.isEmpty ? "Life Journal" : trimmed
        let invalid = CharacterSet(charactersIn: "/\\:?%*|\"<>")
        return cleaned.components(separatedBy: invalid).joined(separator: "-")
    }
}

/// Wraps `UIActivityViewController` so a generated file can be shared/saved.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
