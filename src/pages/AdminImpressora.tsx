import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { connectUsbPrinter, disconnectUsbPrinter, getDefaultUsbPrinterName, isUsbPrinterAvailable, isUsbPrinterConnected, printUsbText } from "../services/usbPrinter";
import { AlertTriangle, CheckCircle2, Printer } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  Conectado: "bg-green-500/10 text-green-300 border-green-500/20",
  Desconectado: "bg-white/5 text-white/70 border-white/10",
  "Conectando...": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  "Falha na conexao": "bg-red-500/10 text-red-300 border-red-500/20",
  "Imprimindo...": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  "Impressao concluida": "bg-green-500/10 text-green-300 border-green-500/20",
  "Falha na impressao": "bg-red-500/10 text-red-300 border-red-500/20",
};

export default function AdminImpressora() {
  const [printerStatus, setPrinterStatus] = useState("Desconectado");
  const [printerSupport, setPrinterSupport] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const printerName = getDefaultUsbPrinterName();

  const appendLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((current) => [`[${timestamp}] ${message}`, ...current].slice(0, 12));
  };

  useEffect(() => {
    setPrinterSupport(isUsbPrinterAvailable());
    if (isUsbPrinterConnected()) {
      setPrinterStatus("Conectado");
      appendLog("Impressora ja esta pronta para uso.");
    }
  }, []);

  const handleConnect = async () => {
    if (!printerSupport) {
      appendLog("Impressao pelo navegador nao suportada neste ambiente.");
      return;
    }

    setIsWorking(true);
    setPrinterStatus("Conectando...");
    appendLog(`Preparando impressora ${printerName}...`);

    try {
      await connectUsbPrinter();
      setPrinterStatus("Conectado");
      appendLog(`Impressora ${printerName} pronta para imprimir.`);
    } catch (error) {
      setPrinterStatus("Falha na conexao");
      appendLog(`Erro ao conectar: ${(error as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsWorking(true);
    appendLog("Desconectando impressora...");

    try {
      await disconnectUsbPrinter();
      setPrinterStatus("Desconectado");
      appendLog("Impressora desconectada.");
    } catch (error) {
      appendLog(`Erro ao desconectar: ${(error as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrintTest = async () => {
    if (!printerSupport) {
      appendLog("Impressao pelo navegador nao suportada neste ambiente.");
      return;
    }

    setIsWorking(true);
    setPrinterStatus("Imprimindo...");
    appendLog(`Abrindo impressao de teste para ${printerName}...`);

    try {
      await printUsbText("TESTE DE IMPRESSAO YAKINHOME\n\nImpressora: KP-IM607 / POS58\n\nObrigado pela conexao!\n\n");
      setPrinterStatus("Impressao concluida");
      appendLog("Janela de impressao aberta com sucesso.");
    } catch (error) {
      setPrinterStatus("Falha na impressao");
      appendLog(`Erro ao imprimir: ${(error as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111111] px-4 py-3">
                <Printer size={18} className="text-[#c0261a]" />
                <div>
                  <h1 className="text-white font-black text-xl tracking-tight">Impressora</h1>
                  <p className="text-white/40 text-sm">Monitore o status e teste a impressora USB KP-IM607.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleConnect}
                disabled={isWorking}
                className="rounded-2xl bg-[#c0261a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d93025] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Conectar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isWorking}
                className="rounded-2xl border border-white/[0.12] bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:border-[#c0261a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Desconectar
              </button>
              <button
                onClick={handlePrintTest}
                disabled={isWorking}
                className="rounded-2xl bg-sky-500/10 px-5 py-3 text-sm font-bold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Imprimir teste
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-5">
              <div className="flex items-center gap-3 text-sm font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Status atual</div>
              <div className={`rounded-3xl border p-5 ${STATUS_STYLES[printerStatus] ?? STATUS_STYLES.Desconectado}`}>
                <div className="flex items-center gap-3">
                  {printerStatus === "Conectado" ? (
                    <CheckCircle2 size={20} className="text-green-300" />
                  ) : printerStatus.includes("Falha") ? (
                    <AlertTriangle size={20} className="text-red-300" />
                  ) : (
                    <Printer size={20} className="text-white/70" />
                  )}
                  <span className="text-lg font-black text-white">{printerStatus}</span>
                </div>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">
                  {printerSupport
                    ? "Use os botoes para preparar, desconectar ou abrir uma impressao de teste pela impressora USB."
                    : "Este ambiente nao oferece impressao pelo navegador. Abra o painel em um navegador com suporte a window.print."}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.2em] text-white/40">Detalhes</div>
                  <h2 className="text-white font-black text-lg mt-2">Impressora USB</h2>
                </div>
                <span className="text-xs text-white/30">Nome: {printerName}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-white/[0.08] bg-[#0f0f0f] p-4">
                  <p className="text-sm text-white/40 uppercase tracking-[0.2em] mb-3">Suporte</p>
                  <p className="text-sm text-white">{printerSupport ? "Ativo" : "Indisponivel"}</p>
                </div>
                <div className="rounded-3xl border border-white/[0.08] bg-[#0f0f0f] p-4">
                  <p className="text-sm text-white/40 uppercase tracking-[0.2em] mb-3">Ultima impressao</p>
                  <p className="text-sm text-white">{printerStatus === "Impressao concluida" ? "Sucesso" : printerStatus === "Falha na impressao" ? "Falha" : "Ainda nao testado"}</p>
                </div>
              </div>
              <div className="mt-6 rounded-3xl border border-white/[0.08] bg-[#0f0f0f] p-4">
                <p className="text-sm text-white/40 uppercase tracking-[0.2em] mb-3">Instrucoes</p>
                <ul className="list-disc list-inside space-y-2 text-sm text-white/60">
                  <li>Conecte a KP-IM607 via USB e instale o driver no Windows.</li>
                  <li>Defina a POS58 como impressora padrao ou selecione-a no dialogo de impressao.</li>
                  <li>Use "Imprimir teste" para confirmar a saida antes de receber pedidos.</li>
                  <li>O navegador nao permite escolher uma impressora USB pelo nome automaticamente.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-black text-lg">Logs de atividade</h2>
              <p className="text-white/40 text-sm mt-1">Ultimas acoes de conexao e impressao.</p>
            </div>
            <button
              onClick={() => setLogs([])}
              className="rounded-2xl border border-white/[0.12] px-4 py-2 text-sm font-semibold text-white/50 hover:text-white hover:border-white/25 transition"
            >
              Limpar
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.08] p-8 text-center text-white/30">Nenhuma atividade registrada ainda.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((entry, index) => (
                <div key={index} className="rounded-3xl border border-white/[0.08] bg-[#0f0f0f] p-4 text-sm text-white/70">
                  {entry}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
