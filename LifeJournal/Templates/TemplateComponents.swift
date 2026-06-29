import SwiftUI

// MARK: - Reusable building blocks for page templates.
// All sizes are in canonical page points (see LJTheme.pageSize).

/// A tracked, uppercase section label like the printed planner ("DAY", "NOTES / TASKS").
struct SectionLabel: View {
    let text: String
    var size: CGFloat = 17
    var color: Color = LJTheme.softInk
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: size, weight: .semibold))
            .tracking(3)
            .foregroundColor(color)
    }
}

/// A small caption used under labels.
struct Caption: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .regular))
            .italic()
            .foregroundColor(LJTheme.softInk.opacity(0.9))
    }
}

/// A labelled fill-in field: "Speaker ____________".
struct FieldLine: View {
    let label: String
    var labelWidth: CGFloat = 92
    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            Text(label.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .tracking(2)
                .foregroundColor(LJTheme.softInk)
                .frame(width: labelWidth, alignment: .leading)
            Rectangle()
                .fill(LJTheme.rule)
                .frame(height: 1)
                .offset(y: -4)
        }
    }
}

/// Evenly spaced horizontal writing rules filling the available height.
struct RuledLines: View {
    var spacing: CGFloat = 46
    var color: Color = LJTheme.faint
    var body: some View {
        GeometryReader { geo in
            Canvas { ctx, size in
                var y: CGFloat = spacing
                while y < size.height {
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    ctx.stroke(path, with: .color(color), lineWidth: 1)
                    y += spacing
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}

/// A dot grid.
struct DotGrid: View {
    var spacing: CGFloat = 40
    var color: Color = LJTheme.rule
    var body: some View {
        Canvas { ctx, size in
            var y = spacing
            while y < size.height {
                var x = spacing
                while x < size.width {
                    let r = CGRect(x: x - 1.1, y: y - 1.1, width: 2.2, height: 2.2)
                    ctx.fill(Path(ellipseIn: r), with: .color(color))
                    x += spacing
                }
                y += spacing
            }
        }
    }
}

/// A square grid.
struct GridLines: View {
    var spacing: CGFloat = 40
    var color: Color = LJTheme.faint
    var body: some View {
        Canvas { ctx, size in
            var x = spacing
            while x < size.width {
                var p = Path(); p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x, y: size.height))
                ctx.stroke(p, with: .color(color), lineWidth: 1)
                x += spacing
            }
            var y = spacing
            while y < size.height {
                var p = Path(); p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: size.width, y: y))
                ctx.stroke(p, with: .color(color), lineWidth: 1)
                y += spacing
            }
        }
    }
}

/// A column of checkbox rows with writing rules.
struct CheckboxRows: View {
    var count: Int
    var spacing: CGFloat = 46
    var body: some View {
        VStack(spacing: spacing - 22) {
            ForEach(0..<count, id: \.self) { _ in
                HStack(alignment: .bottom, spacing: 14) {
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(LJTheme.rule, lineWidth: 1.5)
                        .frame(width: 20, height: 20)
                    Rectangle()
                        .fill(LJTheme.faint)
                        .frame(height: 1)
                        .offset(y: -6)
                }
            }
        }
    }
}

/// A numbered list with writing rules (1. ____, 2. ____ ...).
struct NumberedRows: View {
    var count: Int
    var spacing: CGFloat = 46
    var startAt: Int = 1
    var body: some View {
        VStack(spacing: spacing - 22) {
            ForEach(0..<count, id: \.self) { i in
                HStack(alignment: .bottom, spacing: 14) {
                    Text("\(startAt + i).")
                        .font(.system(size: 17, weight: .semibold, design: .serif))
                        .foregroundColor(LJTheme.softInk)
                        .frame(width: 28, alignment: .leading)
                    Rectangle()
                        .fill(LJTheme.faint)
                        .frame(height: 1)
                        .offset(y: -6)
                }
            }
        }
    }
}

/// A titled block: a section label, optional caption, and content beneath.
struct LabeledBlock<Content: View>: View {
    let title: String
    var caption: String? = nil
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: title)
            if let caption { Caption(text: caption) }
            content
        }
    }
}

/// A light divider rule.
struct HairlineRule: View {
    var color: Color = LJTheme.rule
    var body: some View {
        Rectangle().fill(color).frame(height: 1)
    }
}
