import SwiftUI

/// A small book-cover thumbnail used on the library shelf.
struct JournalCoverView: View {
    let journal: Journal

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10)
                .fill(LinearGradient(colors: [journal.cover.primary, journal.cover.secondary],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            // spine highlight
            HStack(spacing: 0) {
                Rectangle().fill(Color.white.opacity(0.12)).frame(width: 10)
                Spacer()
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))

            RoundedRectangle(cornerRadius: 6)
                .stroke(journal.cover.foil.opacity(0.55), lineWidth: 1)
                .padding(10)

            VStack(spacing: 10) {
                Image(systemName: "cross")
                    .font(.system(size: 20, weight: .light))
                    .foregroundColor(journal.cover.foil)
                Text(journal.title)
                    .font(.system(size: 19, weight: .bold, design: .serif))
                    .foregroundColor(journal.cover.foil)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 12)
                Rectangle()
                    .fill(journal.cover.foil.opacity(0.7))
                    .frame(width: 34, height: 1)
            }
            .padding(14)
        }
        .aspectRatio(0.77, contentMode: .fit)
        .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 5)
    }
}
