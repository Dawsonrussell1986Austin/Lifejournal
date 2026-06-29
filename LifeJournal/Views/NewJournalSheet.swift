import SwiftUI

/// Collects a title, cover style, and starting page for a new journal.
struct NewJournalSheet: View {
    var onCreate: (_ title: String, _ cover: CoverStyle, _ firstTemplate: PageTemplate?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var cover: CoverStyle = .sage
    @State private var firstTemplate: PageTemplate = .soap

    private let coverColumns = [GridItem(.adaptive(minimum: 96), spacing: 16)]

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("e.g. My Life Journal", text: $title)
                        .font(.system(.body, design: .serif))
                }

                Section("Cover") {
                    LazyVGrid(columns: coverColumns, spacing: 16) {
                        ForEach(CoverStyle.allCases) { style in
                            Button {
                                cover = style
                            } label: {
                                VStack(spacing: 6) {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(LinearGradient(colors: [style.primary, style.secondary],
                                                             startPoint: .top, endPoint: .bottom))
                                        .frame(height: 64)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(style == cover ? LJTheme.ink : Color.clear, lineWidth: 3)
                                        )
                                    Text(style.displayName)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Start with a page") {
                    Picker("First page", selection: $firstTemplate) {
                        ForEach(PageTemplate.insertable) { t in
                            Label(t.displayName, systemImage: t.systemImage).tag(t)
                        }
                    }
                    .pickerStyle(.navigationLink)
                    Text("A cover page is always added first. You can add more pages anytime.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("New Journal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        onCreate(title, cover, firstTemplate)
                        dismiss()
                    }
                }
            }
        }
    }
}
