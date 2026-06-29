import SwiftUI

/// The shelf: a grid of journals with a button to start a new one.
struct LibraryView: View {
    @EnvironmentObject private var store: JournalStore
    @State private var showingNewJournal = false
    @State private var openJournalID: UUID?
    @State private var journalPendingDelete: Journal?
    @State private var exportedPDF: ExportedPDF?

    private let columns = [GridItem(.adaptive(minimum: 170, maximum: 220), spacing: 28)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 34) {
                    newJournalTile
                    ForEach(store.journals) { journal in
                        Button {
                            openJournalID = journal.id
                        } label: {
                            VStack(spacing: 10) {
                                JournalCoverView(journal: journal)
                                Text("\(journal.pages.count) page\(journal.pages.count == 1 ? "" : "s")")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button {
                                exportedPDF = PDFExporter.export(journal: journal, store: store)
                            } label: {
                                Label("Export as PDF", systemImage: "square.and.arrow.up")
                            }
                            Button(role: .destructive) {
                                journalPendingDelete = journal
                            } label: {
                                Label("Delete Journal", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(28)
            }
            .background(LJTheme.shelf.ignoresSafeArea())
            .navigationTitle("Life Journal")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if store.isCloudEnabled {
                        Label("Synced with iCloud", systemImage: "checkmark.icloud")
                            .labelStyle(.iconOnly)
                            .foregroundColor(LJTheme.accent)
                            .help("Your journals sync with iCloud")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingNewJournal = true
                    } label: {
                        Label("New Journal", systemImage: "plus")
                    }
                }
            }
            .fullScreenCover(item: $openJournalID) { id in
                JournalView(journalID: id)
                    .environmentObject(store)
            }
            .sheet(isPresented: $showingNewJournal) {
                NewJournalSheet { title, cover, template in
                    let journal = store.createJournal(title: title, cover: cover, firstTemplate: template)
                    openJournalID = journal.id
                }
            }
            .sheet(item: $exportedPDF) { pdf in
                ShareSheet(items: [pdf.url])
            }
            .alert(item: $journalPendingDelete) { journal in
                Alert(
                    title: Text("Delete “\(journal.title)”?"),
                    message: Text("This permanently deletes the journal and all of its pages."),
                    primaryButton: .destructive(Text("Delete")) {
                        store.deleteJournal(journal.id)
                    },
                    secondaryButton: .cancel()
                )
            }
        }
    }

    private var newJournalTile: some View {
        Button {
            showingNewJournal = true
        } label: {
            VStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                        .foregroundColor(LJTheme.accent.opacity(0.7))
                    VStack(spacing: 10) {
                        Image(systemName: "plus")
                            .font(.system(size: 30, weight: .semibold))
                        Text("New Journal")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundColor(LJTheme.accent)
                }
                .aspectRatio(0.77, contentMode: .fit)
                Text(" ").font(.caption)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Allow `UUID` to drive `.fullScreenCover(item:)`.
extension UUID: Identifiable {
    public var id: UUID { self }
}
