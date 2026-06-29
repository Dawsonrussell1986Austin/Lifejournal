import SwiftUI
import PencilKit

/// Owns the library of journals and persists everything to disk.
///
/// Storage lives under a "LifeJournal" Documents folder:
///   library.json               — journal + page metadata
///   Drawings/<pageID>.pkdrawing — handwriting strokes
///
/// When the user is signed into iCloud and the app's iCloud capability is
/// enabled, that folder is the app's **iCloud Documents** container, so
/// journals sync across the user's iPads automatically. Otherwise it falls
/// back to the on-device Documents directory. All reads/writes are coordinated
/// with `NSFileCoordinator` for safe concurrent/remote access.
@MainActor
final class JournalStore: ObservableObject {
    @Published private(set) var journals: [Journal] = []
    @Published private(set) var isCloudEnabled = false

    private var baseURL: URL
    private var drawingsDir: URL
    private var libraryURL: URL { baseURL.appendingPathComponent("library.json") }

    private var metadataQuery: NSMetadataQuery?

    init() {
        let local = Self.localBase()
        baseURL = local
        drawingsDir = local.appendingPathComponent("Drawings", isDirectory: true)
        Self.ensureDir(drawingsDir)
        load()
        resolveCloudStorage()
    }

    // MARK: - Storage locations

    private static func localBase() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LifeJournal", isDirectory: true)
    }

    private static func ensureDir(_ url: URL) {
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    }

    /// Resolving the iCloud container can block, so do it off the main thread,
    /// then switch storage over on the main actor.
    private func resolveCloudStorage() {
        Task.detached(priority: .utility) {
            let fm = FileManager.default
            guard let container = fm.url(forUbiquityContainerIdentifier: nil) else { return }
            let cloudDocs = container.appendingPathComponent("Documents", isDirectory: true)
            await self.adoptCloudStorage(at: cloudDocs)
        }
    }

    private func adoptCloudStorage(at cloudDocs: URL) {
        let fm = FileManager.default
        let cloudDrawings = cloudDocs.appendingPathComponent("Drawings", isDirectory: true)
        Self.ensureDir(cloudDrawings)

        // First time on iCloud: seed the cloud from whatever is on this device.
        let cloudLibrary = cloudDocs.appendingPathComponent("library.json")
        if !fm.fileExists(atPath: cloudLibrary.path) {
            migrateLocalContents(toCloudDocs: cloudDocs)
        }

        baseURL = cloudDocs
        drawingsDir = cloudDrawings
        isCloudEnabled = true
        load()
        startWatchingCloud()
    }

    private func migrateLocalContents(toCloudDocs cloudDocs: URL) {
        let fm = FileManager.default
        let localLib = Self.localBase().appendingPathComponent("library.json")
        if let data = try? Data(contentsOf: localLib) {
            coordinatedWrite(cloudDocs.appendingPathComponent("library.json"), data)
        }
        let localDrawings = Self.localBase().appendingPathComponent("Drawings", isDirectory: true)
        if let files = try? fm.contentsOfDirectory(at: localDrawings, includingPropertiesForKeys: nil) {
            for file in files where file.pathExtension == "pkdrawing" {
                if let data = try? Data(contentsOf: file) {
                    coordinatedWrite(cloudDocs.appendingPathComponent("Drawings").appendingPathComponent(file.lastPathComponent), data)
                }
            }
        }
    }

    // MARK: - Live iCloud updates

    private func startWatchingCloud() {
        let query = NSMetadataQuery()
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
        query.predicate = NSPredicate(format: "%K LIKE %@", NSMetadataItemFSNameKey, "library.json")
        NotificationCenter.default.addObserver(
            self, selector: #selector(cloudDidChange),
            name: .NSMetadataQueryDidUpdate, object: query)
        NotificationCenter.default.addObserver(
            self, selector: #selector(cloudDidChange),
            name: .NSMetadataQueryDidFinishGathering, object: query)
        metadataQuery = query
        query.start()
    }

    @objc private func cloudDidChange() {
        // Reload the library metadata when another device changes it.
        load()
    }

    // MARK: - Coordinated file IO

    private func coordinatedWrite(_ url: URL, _ data: Data) {
        var coordError: NSError?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordError) { newURL in
            try? data.write(to: newURL, options: .atomic)
        }
    }

    private func coordinatedRead(_ url: URL) -> Data? {
        try? FileManager.default.startDownloadingUbiquitousItem(at: url)
        var result: Data?
        var coordError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordError) { newURL in
            result = try? Data(contentsOf: newURL)
        }
        return result
    }

    private func coordinatedDelete(_ url: URL) {
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        var coordError: NSError?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordError) { newURL in
            try? FileManager.default.removeItem(at: newURL)
        }
    }

    // MARK: - Library lifecycle

    private func load() {
        if let data = coordinatedRead(libraryURL),
           let decoded = try? JSONDecoder().decode([Journal].self, from: data) {
            journals = decoded
        } else if journals.isEmpty {
            journals = [Journal.sample()]
            persist()
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(journals) else { return }
        coordinatedWrite(libraryURL, data)
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
            coordinatedDelete(drawingURL(page.id))
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
        coordinatedDelete(drawingURL(pageID))
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
        guard let data = coordinatedRead(drawingURL(pageID)),
              let drawing = try? PKDrawing(data: data) else {
            return PKDrawing()
        }
        return drawing
    }

    func saveDrawing(_ pageID: UUID, _ drawing: PKDrawing) {
        coordinatedWrite(drawingURL(pageID), drawing.dataRepresentation())
    }
}
