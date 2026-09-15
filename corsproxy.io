// ✅ CORS Proxy သုံးပြီး download လုပ်မယ်
async function downloadWithProxy(url, filename) {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const btn = document.querySelector('.download-btn');
    
    try {
        if (btn) {
            btn.textContent = '⏳ Downloading...';
            btn.disabled = true;
        }
        
        const response = await fetch(proxyUrl);
        const blob = await response.blob();
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        
        if (btn) {
            btn.textContent = '✅ Downloaded!';
            btn.style.background = '#22c55e';
            setTimeout(() => {
                btn.textContent = '📥 Download APK';
                btn.disabled = false;
                btn.style.background = '#1a8cff';
            }, 3000);
        }
    } catch (error) {
        console.error('Download error:', error);
        // Fallback: open in new tab
        window.open(url, '_blank');
        
        if (btn) {
            btn.textContent = '📥 Download APK';
            btn.disabled = false;
            btn.style.background = '#1a8cff';
        }
    }
}