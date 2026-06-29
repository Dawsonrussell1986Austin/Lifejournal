import SwiftUI
import PencilKit

/// SwiftUI wrapper around a zoomable PencilKit canvas with a template image
/// behind the ink. This is what gives the GoodNotes-style writing experience:
/// pressure, tilt, palm rejection and low-latency ink all come from PencilKit.
struct PencilCanvas: UIViewControllerRepresentable {
    let initialDrawing: PKDrawing
    let templateImage: UIImage?
    var allowsFingerDrawing: Bool
    var onChange: (PKDrawing) -> Void

    func makeUIViewController(context: Context) -> PageCanvasController {
        let controller = PageCanvasController()
        controller.configure(drawing: initialDrawing,
                             templateImage: templateImage,
                             allowsFinger: allowsFingerDrawing)
        controller.onChange = onChange
        return controller
    }

    func updateUIViewController(_ controller: PageCanvasController, context: Context) {
        controller.setAllowsFinger(allowsFingerDrawing)
        controller.onChange = onChange
    }
}

/// UIKit controller that hosts a `PKCanvasView`, a background image view for the
/// page template, and the system tool picker.
final class PageCanvasController: UIViewController, PKCanvasViewDelegate, UIScrollViewDelegate {
    let canvasView = PKCanvasView()
    private let backgroundView = UIImageView()
    private let toolPicker = PKToolPicker()
    private let pageSize = LJTheme.pageSize

    var onChange: ((PKDrawing) -> Void)?
    private var didSetInitialZoom = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(white: 0.91, alpha: 1.0)

        // Background (the printed template) lives inside the scrollable content
        // so it pans and zooms together with the ink.
        backgroundView.frame = CGRect(origin: .zero, size: pageSize)
        backgroundView.contentMode = .scaleAspectFit
        backgroundView.backgroundColor = .white
        backgroundView.layer.shadowColor = UIColor.black.cgColor
        backgroundView.layer.shadowOpacity = 0.12
        backgroundView.layer.shadowRadius = 14
        backgroundView.layer.shadowOffset = CGSize(width: 0, height: 6)

        canvasView.frame = view.bounds
        canvasView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        canvasView.delegate = self
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.alwaysBounceVertical = true
        canvasView.contentSize = pageSize
        canvasView.minimumZoomScale = 0.25
        canvasView.maximumZoomScale = 4.0
        canvasView.addSubview(backgroundView)
        canvasView.sendSubviewToBack(backgroundView)
        view.addSubview(canvasView)

        // Show the system tool picker (pen, marker, eraser, lasso, colors, ruler).
        toolPicker.addObserver(canvasView)
        toolPicker.setVisible(true, forFirstResponder: canvasView)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        canvasView.becomeFirstResponder()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard !didSetInitialZoom, view.bounds.width > 0 else { return }
        didSetInitialZoom = true
        zoomToFit()
    }

    // MARK: - Configuration

    func configure(drawing: PKDrawing, templateImage: UIImage?, allowsFinger: Bool) {
        loadViewIfNeeded()
        canvasView.drawing = drawing
        backgroundView.image = templateImage
        setAllowsFinger(allowsFinger)
    }

    func setAllowsFinger(_ allowsFinger: Bool) {
        canvasView.drawingPolicy = allowsFinger ? .anyInput : .pencilOnly
    }

    private func zoomToFit() {
        let inset: CGFloat = 24
        let availableW = view.bounds.width - inset * 2
        let availableH = view.bounds.height - inset * 2
        let scale = min(availableW / pageSize.width, availableH / pageSize.height)
        canvasView.minimumZoomScale = min(scale, 1.0)
        canvasView.zoomScale = scale
        centerPage()
    }

    private func centerPage() {
        let scaledW = pageSize.width * canvasView.zoomScale
        let scaledH = pageSize.height * canvasView.zoomScale
        let offsetX = max(0, (canvasView.bounds.width - scaledW) / 2)
        let offsetY = max(0, (canvasView.bounds.height - scaledH) / 2)
        canvasView.contentInset = UIEdgeInsets(top: offsetY, left: offsetX, bottom: offsetY, right: offsetX)
    }

    // MARK: - PKCanvasViewDelegate

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        onChange?(canvasView.drawing)
    }

    // MARK: - UIScrollViewDelegate

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        centerPage()
    }
}
