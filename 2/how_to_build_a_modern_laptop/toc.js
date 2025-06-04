// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="how-to-build-laptop.html">How To Build a Modern Laptop</a></li><li class="chapter-item expanded "><a href="overview.html"><strong aria-hidden="true">1.</strong> Overview</a></li><li class="chapter-item expanded "><a href="setting_up.html"><strong aria-hidden="true">2.</strong> Setting up Development</a></li><li class="chapter-item expanded "><a href="ec/embedded_controller.html"><strong aria-hidden="true">3.</strong> Embedded Controller</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="ec/battery.html"><strong aria-hidden="true">3.1.</strong> Battery</a></li><li class="chapter-item expanded "><a href="ec/charger.html"><strong aria-hidden="true">3.2.</strong> Charger</a></li><li class="chapter-item expanded "><a href="ec/thermal.html"><strong aria-hidden="true">3.3.</strong> Thermal</a></li><li class="chapter-item expanded "><a href="ec/connectivity.html"><strong aria-hidden="true">3.4.</strong> Connectivity</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="ec/usb.html"><strong aria-hidden="true">3.4.1.</strong> USB</a></li><li class="chapter-item expanded "><a href="ec/wifi.html"><strong aria-hidden="true">3.4.2.</strong> WiFi</a></li><li class="chapter-item expanded "><a href="ec/bluetooth.html"><strong aria-hidden="true">3.4.3.</strong> Bluetooth</a></li></ol></li></ol></li><li class="chapter-item expanded "><a href="patina/patina.html"><strong aria-hidden="true">4.</strong> Patina</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="patina/security.html"><strong aria-hidden="true">4.1.</strong> Security</a></li><li class="chapter-item expanded "><a href="patina/dxe.html"><strong aria-hidden="true">4.2.</strong> DXE</a></li><li class="chapter-item expanded "><a href="patina/runtime.html"><strong aria-hidden="true">4.3.</strong> Runtime</a></li><li class="chapter-item expanded "><a href="patina/windows.html"><strong aria-hidden="true">4.4.</strong> Booting into Windows</a></li></ol></li><li class="chapter-item expanded "><a href="using.html"><strong aria-hidden="true">5.</strong> Using your Virtual Laptop</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="first_checks.html"><strong aria-hidden="true">5.1.</strong> First Checks</a></li><li class="chapter-item expanded "><a href="application.html"><strong aria-hidden="true">5.2.</strong> Running an application</a></li></ol></li><li class="chapter-item expanded "><a href="conclusions.html"><strong aria-hidden="true">6.</strong> Summary and Takeaways</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
