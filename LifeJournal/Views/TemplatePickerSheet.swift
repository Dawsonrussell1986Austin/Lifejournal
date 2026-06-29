import SwiftUI

/// Lets the user choose a template when adding a new page. Shows a live
/// miniature preview of each layout.
struct TemplatePickerSheet: View {
    var onPick: (PageTemplate) -> Void
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 22)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(PageTemplate.insertable) { template in
                        Button {
                            onPick(template)
                            dismiss()
                        } label: {
                            VStack(spacing: 8) {
                                TemplateThumbnail(template: template)
                                Text(template.displayName)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(.primary)
                                    .multilineTextAlignment(.center)
                                Text(template.subtitle)
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(24)
            }
            .background(LJTheme.shelf.ignoresSafeArea())
            .navigationTitle("Add a Page")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

/// Scaled-down render of a template used for previews/thumbnails.
struct TemplateThumbnail: View {
    let template: PageTemplate
    var body: some View {
        TemplateBackground(template: template)
            .frame(width: LJTheme.pageSize.width, height: LJTheme.pageSize.height)
            .scaleEffect(150 / LJTheme.pageSize.width, anchor: .topLeading)
            .frame(width: 150, height: 150 * LJTheme.pageSize.height / LJTheme.pageSize.width)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(LJTheme.rule, lineWidth: 1))
            .shadow(color: .black.opacity(0.12), radius: 5, y: 3)
    }
}
