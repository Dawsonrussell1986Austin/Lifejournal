import SwiftUI
import PencilKit
import UIKit

/// Full-screen journal editor: a page canvas with the Apple Pencil tool picker,
/// plus chrome for navigating, adding and deleting pages.
struct JournalView: View {
    let journalID: UUID
    @EnvironmentObject private var store: JournalStore
    @Environment(\.dismiss) private var dismiss

    @State private var pageIndex = 0
    @State private var drawing = PKDrawing()
    @State private var templateImage: UIImage?
    @State private var allowsFinger = false
    @State private var saveWork: DispatchWorkItem?

    @State private var showTemplatePicker = false
    @State private var showThumbnails = false
    @State private var pageToDelete: JournalPage?
    @State private var exportedPDF: ExportedPDF?
    @State private var isExporting = false

    private var journal: Journal? { store.journal(journalID) }
    private var pages: [JournalPage] { journal?.pages ?? [] }
    private var currentPage: JournalPage? {
        guard pageIndex >= 0, pageIndex < pages.count else { return nil }
        return pages[pageIndex]
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            canvasArea
        }
        .background(Color(white: 0.91).ignoresSafeArea())
        .onAppear { loadPage(at: pageIndex) }
        .onDisappear { flushSave() }
        .sheet(isPresented: $showTemplatePicker) {
            TemplatePickerSheet { template in
                addPage(template)
            }
        }
        .sheet(isPresented: $showThumbnails) {
            PageThumbnailGrid(journalID: journalID, currentIndex: pageIndex) { index in
                goToPage(index)
                showThumbnails = false
            }
            .environmentObject(store)
        }
        .alert(item: $pageToDelete) { page in
            Alert(
                title: Text("Delete this page?"),
                message: Text("Handwriting on this page will be permanently removed."),
                primaryButton: .destructive(Text("Delete")) { deletePage(page) },
                secondaryButton: .cancel()
            )
        }
        .sheet(item: $exportedPDF) { pdf in
            ShareSheet(items: [pdf.url])
        }
    }

    private func exportPDF() {
        guard let journal else { return }
        flushSave()
        isExporting = true
        // Defer a tick so the spinner shows before the (synchronous) render.
        DispatchQueue.main.async {
            exportedPDF = PDFExporter.export(journal: journal, store: store)
            isExporting = false
        }
    }

    // MARK: - Canvas

    @ViewBuilder
    private var canvasArea: some View {
        if let page = currentPage {
            PencilCanvas(
                initialDrawing: drawing,
                templateImage: templateImage,
                allowsFingerDrawing: allowsFinger,
                onChange: handleDrawingChange
            )
            .id(page.id) // rebuild the canvas when the page changes
            .ignoresSafeArea(edges: .bottom)
        } else {
            Spacer()
            Text("This journal has no pages.").foregroundColor(.secondary)
            Spacer()
        }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 18) {
            Button {
                flushSave()
                dismiss()
            } label: {
                Label("Library", systemImage: "chevron.left")
                    .labelStyle(.titleAndIcon)
            }

            Divider().frame(height: 22)

            Button { goToPage(pageIndex - 1) } label: {
                Image(systemName: "chevron.left.circle")
            }
            .disabled(pageIndex <= 0)

            Button { showThumbnails = true } label: {
                Text("\(pages.isEmpty ? 0 : pageIndex + 1) / \(pages.count)")
                    .font(.system(size: 15, weight: .medium))
                    .monospacedDigit()
            }

            Button { goToPage(pageIndex + 1) } label: {
                Image(systemName: "chevron.right.circle")
            }
            .disabled(pageIndex >= pages.count - 1)

            Spacer()

            Text(journal?.title ?? "Journal")
                .font(.system(size: 16, weight: .semibold, design: .serif))
                .lineLimit(1)

            Spacer()

            Toggle(isOn: $allowsFinger) {
                Image(systemName: allowsFinger ? "hand.draw.fill" : "applepencil")
            }
            .toggleStyle(.button)
            .help("Toggle finger drawing")

            Button { showThumbnails = true } label: {
                Image(systemName: "square.grid.2x2")
            }

            Button { showTemplatePicker = true } label: {
                Image(systemName: "plus.rectangle.on.rectangle")
            }

            Menu {
                Button {
                    exportPDF()
                } label: {
                    Label("Export Journal as PDF", systemImage: "square.and.arrow.up")
                }
                Button(role: .destructive) {
                    if let page = currentPage { pageToDelete = page }
                } label: {
                    Label("Delete This Page", systemImage: "trash")
                }
                .disabled(pages.count <= 1)
            } label: {
                if isExporting {
                    ProgressView()
                } else {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .font(.system(size: 18))
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(.regularMaterial)
    }

    // MARK: - Page lifecycle

    private func loadPage(at index: Int) {
        guard index >= 0, index < pages.count else { return }
        pageIndex = index
        let page = pages[index]
        drawing = store.loadDrawing(page.id)
        templateImage = renderTemplate(for: page)
    }

    private func goToPage(_ index: Int) {
        guard index >= 0, index < pages.count, index != pageIndex else { return }
        flushSave()
        loadPage(at: index)
    }

    private func addPage(_ template: PageTemplate) {
        flushSave()
        if let page = store.addPage(journalID: journalID, template: template, after: pageIndex),
           let newIndex = store.journal(journalID)?.pages.firstIndex(of: page) {
            loadPage(at: newIndex)
        }
    }

    private func deletePage(_ page: JournalPage) {
        guard pages.count > 1 else { return }
        let removingIndex = pages.firstIndex(of: page) ?? pageIndex
        store.deletePage(journalID: journalID, pageID: page.id)
        let newIndex = min(removingIndex, (store.journal(journalID)?.pages.count ?? 1) - 1)
        loadPage(at: max(0, newIndex))
    }

    // MARK: - Drawing persistence (debounced)

    private func handleDrawingChange(_ newDrawing: PKDrawing) {
        drawing = newDrawing
        guard let page = currentPage else { return }
        saveWork?.cancel()
        let pageID = page.id
        let work = DispatchWorkItem { [drawing] in
            store.saveDrawing(pageID, drawing)
        }
        saveWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: work)
    }

    private func flushSave() {
        saveWork?.cancel()
        saveWork = nil
        if let page = currentPage {
            store.saveDrawing(page.id, drawing)
        }
    }

    // MARK: - Template rendering

    private func renderTemplate(for page: JournalPage) -> UIImage? {
        guard let journal else { return nil }
        return TemplateRenderer.templateImage(for: page, in: journal, scale: UIScreen.main.scale)
    }
}
