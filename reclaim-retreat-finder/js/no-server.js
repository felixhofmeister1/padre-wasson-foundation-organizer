// Opened straight from disk (file://), browsers block the quiz module and trips.json, so say how to serve it.
if (window.location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('file-warning').hidden = false;
  });
}
