// ─────────────────────────────────────────────────────────────────────────────
// StrategyExporter
// ─────────────────────────────────────────────────────────────────────────────

export class StrategyExporter {
    static exportToJson(strategy) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(strategy, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `nexus-strategy-${strategy.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    static async importFromJson(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const strategy = JSON.parse(e.target.result);
                    // Basic validation to ensure it's a Nexus strategy
                    if (!strategy.name || !strategy.universe || !strategy.backtestConfig) {
                        throw new Error("Invalid Nexus Strategy file format.");
                    }
                    resolve(strategy);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }
}
