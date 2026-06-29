import SwiftUI
import PencilKit

/// Owns the library of journals and persists everything to the app's
/// Documents directory:
///   Documents/LifeJournal/library.json          — journal + page metadata
///   Documents/LifeJournal/Drawings/<pageID>.pkdrawing — handwriting strokes
@MainActor
final class JournalStore: ObservableObject {
    @Published private(set) var journals: [Journal] = []

    private let root: URL
    private let libraryURL: URL
    private let drawingsDir: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        root = docs.appendingPathComponent("LifeJournal", isDirectory: true)
        libraryURL = root.appendingPathComponent("library.json")
        drawingsDir = root.appendingPathComponent("Drawings", isDirectory: true)
        try? FileManager.default.createDirectory(at: drawingsDir, withIntermediateDirectories: true)
        load()
    }

    // MARK: - Library lifecycle

    private func load() {
        if let data = try? Data(contentsOf: libraryURL),
           let decoded = try? JSONDecoder().decode([Journal].self, from: data) {
            journals = decoded
        } else {
            journals = [Journal.sample()]
            persist()
        }
    }

    private func persist() {
        do {
            let data = try JSONEncoder().encode(journals)
            try data.write(to: libraryURL, options: .atomic)
        } catch {
            print("LifeJournal: failed to save library — \(error)")
        }
    }

    func journal(_ id: UUID) -> Journal? {
        journals.first { $0.id == id }
    }

    // MARK: - Journals

    @discardableResult
    func createJournal(title: String, cover: CoverStyle, firstTemplate: PageTemplate?) -> Journal {
        var journal = Journal(title: title.trimmingCharacters(in: .whitespaces).isEmpty ? "Untitled Journal" : title,
                              cover: cover)
        journal.pages.append(JournalPage(template: .cover))
        if let first = firstTemplate, first != .cover {
            journal.pages.append(JournalPage(template: first))
        }
        journals.insert(journal, at: 0)
        persist()
        return journal
    }

    func renameJournal(_ id: UUID, to title: String) {
        guard let i = journals.firstIndex(where: { $0.id == id }) else { return }
        journals[i].title = title
        persist()
    }

    func setCover(_ id: UUID, to cover: CoverStyle) {
        guard let i = journals.firstIndex(where: { $0.id == id }) else { return }
        journals[i].cover = cover
        persist()
    }

    func deleteJournal(_ id: UUID) {
        guard let i = journals.firstIndex(where: { $0.id == id }) else { return }
        for page in journals[i].pages {
            try? FileManager.default.removeItem(at: drawingURL(page.id))
        }
        journals.remove(at: i)
        persist()
    }

    // MARK: - Pages

    @discardableResult
    func addPage(journalID: UUID, template: PageTemplate, after index: Int? = nil) -> JournalPage? {
        guard let j = journals.firstIndex(where: { $0.id == journalID }) else { return nil }
        let page = JournalPage(template: template)
        if let index, index >= 0, index < journals[j].pages.count {
            journals[j].pages.insert(page, at: index + 1)
        } else {
            journals[j].pages.append(page)
        }
        persist()
        return page
    }

    func deletePage(journalID: UUID, pageID: UUID) {
        guard let j = journals.firstIndex(where: { $0.id == journalID }) else { return }
        journals[j].pages.removeAll { $0.id == pageID }
        try? FileManager.default.removeItem(at: drawingURL(pageID))
        persist()
    }

    func movePage(journalID: UUID, from: IndexSet, to: Int) {
        guard let j = journals.firstIndex(where: { $0.id == journalID }) else { return }
        journals[j].pages.move(fromOffsets: from, toOffset: to)
        persist()
    }

    // MARK: - Drawings

    private func drawingURL(_ pageID: UUID) -> URL {
        drawingsDir.appendingPathComponent("\(pageID.uuidString).pkdrawing")
    }

    func loadDrawing(_ pageID: UUID) -> PKDrawing {
        guard let data = try? Data(contentsOf: drawingURL(pageID)),
              let drawing = try? PKDrawing(data: data) else {
            return PKDrawing()
        }
        return drawing
    }

    func saveDrawing(_ pageID: UUID, _ drawing: PKDrawing) {
        do {
            try drawing.dataRepresentation().write(to: drawingURL(pageID), options: .atomic)
        } catch {
            print("LifeJournal: failed to save drawing — \(error)")
        }
    }
}
