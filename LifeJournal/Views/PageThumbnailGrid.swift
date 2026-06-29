import SwiftUI
import PencilKit
import UIKit

/// A grid of every page in the journal (template + handwriting) for quick
/// navigation, shown as a sheet.
struct PageThumbnailGrid: View {
    let journalID: UUID
    let currentIndex: Int
    var onSelect: (Int) -> Void

    @EnvironmentObject private var store: JournalStore
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 190), spacing: 22)]

    private var pages: [JournalPage] { store.journal(journalID)?.pages ?? [] }
    private var cover: CoverStyle { store.journal(journalID)?.cover ?? .sage }
    private var title: String { store.journal(journalID)?.title ?? "Life Journal" }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(Array(pages.enumerated()), id: \.element.id) { index, page in
                        Button {
                            onSelect(index)
                        } label: {
                            VStack(spacing: 6) {
                                PageThumbnail(
                                    template: page.template,
                                    drawing: store.loadDrawing(page.id),
                                    coverTitle: title,
                                    coverScripture: cover.scripture,
                                    coverStyle: cover
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(index == currentIndex ? LJTheme.accent : LJTheme.rule,
                                                lineWidth: index == currentIndex ? 3 : 1)
                                )
                                Text("\(index + 1) · \(page.template.displayName)")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(24)
            }
            .background(LJTheme.shelf.ignoresSafeArea())
            .navigationTitle("Pages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// A single page thumbnail: the template with the handwriting composited on top.
struct PageThumbnail: View {
    let template: PageTemplate
    let drawing: PKDrawing
    var coverTitle: String = "Life Journal"
    var coverScripture: String = ""
    var coverStyle: CoverStyle = .sage

    private let width: CGFloat = 160
    private var height: CGFloat { width * LJTheme.pageSize.height / LJTheme.pageSize.width }

    var body: some View {
        ZStack {
            TemplateBackground(template: template,
                               coverTitle: coverTitle,
                               coverScripture: coverScripture,
                               coverStyle: coverStyle)
                .frame(width: LJTheme.pageSize.width, height: LJTheme.pageSize.height)
                .scaleEffect(width / LJTheme.pageSize.width, anchor: .topLeading)
                .frame(width: width, height: height)

            if !drawing.bounds.isEmpty {
                Image(uiImage: inkImage())
                    .resizable()
                    .frame(width: width, height: height)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .shadow(color: .black.opacity(0.12), radius: 5, y: 3)
    }

    private func inkImage() -> UIImage {
        let rect = CGRect(origin: .zero, size: LJTheme.pageSize)
        return drawing.image(from: rect, scale: width / LJTheme.pageSize.width)
    }
}
