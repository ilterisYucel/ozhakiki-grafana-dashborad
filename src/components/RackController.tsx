import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Alert, Stack, Input, Card, Text, Badge, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { css } from '@emotion/css';

interface Props extends PanelProps<{}> {}

interface Rack {
  id: number;
  name: string;
  status: 'online' | 'offline';
  soc: number | null;
  soh: number | null;
  charge_status: 'Charge' | 'Discharge' | 'Idle' | null;
  voltage: number | null;
  current: number | null;
  temperature: number | null;
  power_kw: number | null;
  stored_capacity_kwh: number | null;
  remaining_seconds: number | null;
  timestamp: string;
}

interface CommandHistory {
  command: 'CHARGE' | 'DISCHARGE';
  mode: 'TIMER' | 'CONTINUOUS';
  duration?: number;
  remainingSeconds?: number;
  endTime?: Date | null;
  isActive: boolean;
}

export const RackController: React.FC<Props> = ({ width, height }) => {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [selectedRackId, setSelectedRackId] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [operationMode, setOperationMode] = useState<'TIMER' | 'CONTINUOUS'>('CONTINUOUS');
  const [powerKw, setPowerKw] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRacks, setIsLoadingRacks] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCommand, setActiveCommand] = useState<CommandHistory | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const API_URL = 'http://16.171.8.238:8016';

  const styles = useStyles2(() => ({
    container: css`
      padding: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
      background: var(--grays-900);
    `,
    header: css`
      text-align: center;
      margin-bottom: 28px;
    `,
    title: css`
      margin: 0;
      color: var(--primary-color);
      font-size: 24px;
    `,
    mainLayout: css`
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    `,
    racksSection: css`
      flex: 2;
      min-width: 320px;
    `,
    controlSection: css`
      flex: 1;
      min-width: 280px;
    `,
    rackGrid: css`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      min-height: 500px;
      max-height: 550px;
      overflow-y: auto;
      padding: 4px;
    `,
    rackCard: css`
      padding: 14px;
      background: var(--grays-800);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
      &:hover {
        background: var(--grays-700);
        transform: translateY(-2px);
      }
    `,
    rackCardSelected: css`
      border-color: var(--primary-color);
      background: var(--grays-700);
    `,
    rackCardLoading: css`
      opacity: 0.6;
      filter: blur(0.5px);
    `,
    rackName: css`
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
    rackDetails: css`
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 11px;
      margin-top: 10px;
      color: var(--text-muted);
    `,
    rackDetailItem: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
    rackInfo: css`
      padding: 16px;
      background: var(--grays-800);
      border-radius: 8px;
      border: 1px solid var(--grays-600);
    `,
    section: css`
      margin-bottom: 24px;
    `,
    sectionTitle: css`
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 500;
    `,
    buttonGroup: css`
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    `,
    timerDisplay: css`
      font-size: 32px;
      font-weight: bold;
      font-family: monospace;
      text-align: center;
    `,
    infoBox: css`
      margin-top: 24px;
      padding: 16px;
      background: var(--grays-800);
      border-radius: 8px;
      text-align: center;
    `,
    refreshHeader: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    `,
    skeletonCard: css`
      padding: 14px;
      background: var(--grays-800);
      border-radius: 8px;
      animation: pulse 1.5s ease-in-out infinite;
      @keyframes pulse {
        0%,
        100% {
          opacity: 0.4;
        }
        50% {
          opacity: 0.7;
        }
      }
    `,
  }));

  // Rack'leri yükle
  const loadRacks = useCallback(
    async (showSkeleton: boolean = false) => {
      if (showSkeleton) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch(`${API_URL}/api/racks/latest`);
        const data = await response.json();
        setRacks(data.racks || []);
      } catch (error) {
        console.error('Error loading racks:', error);
        setMessage({ type: 'error', text: 'Rackler yüklenemedi!' });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setIsLoadingRacks(false);
        setIsRefreshing(false);
      }
    },
    [API_URL]
  );

  // Manuel refresh
  const handleRefresh = useCallback(async () => {
    if (isRefreshing || isLoading) return;
    await loadRacks(true);
    setMessage({ type: 'info', text: 'Veriler yenilendi!' });
    setTimeout(() => setMessage(null), 2000);
  }, [loadRacks, isRefreshing, isLoading]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && !isLoading && !isRefreshing && !activeCommand?.isActive) {
      autoRefreshIntervalRef.current = setInterval(() => {
        if (!isLoading && !isRefreshing && !activeCommand?.isActive) {
          loadRacks(false);
        }
      }, 5000);
    } else {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    }
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [autoRefresh, loadRacks, isLoading, isRefreshing, activeCommand]);

  useEffect(() => {
    loadRacks(false);
  }, [loadRacks]);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Idle komutu gönder
  const sendIdleCommand = useCallback(async () => {
    try {
      const requestBody: any = {
        charge_status: 'Idle',
        power_kw: 0,
        duration_seconds: 0,
      };
      if (selectedRackId !== null) {
        requestBody.rack_id = selectedRackId;
      }

      await fetch(`${API_URL}/api/commands/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      setActiveCommand(null);
      setMessage({
        type: 'info',
        text: selectedRackId ? `Rack ${selectedRackId} Idle moduna geçti!` : "Tüm rack'ler Idle moduna geçti!",
      });
      setTimeout(() => setMessage(null), 3000);
      setTimeout(() => loadRacks(false), 500);
    } catch (error) {
      console.error('Idle command failed:', error);
    }
  }, [API_URL, selectedRackId, loadRacks]);

  const startTimer = useCallback(
    (command: 'CHARGE' | 'DISCHARGE', durationMinutes: number) => {
      if (operationMode !== 'TIMER') return;
      clearTimer();

      const endTime = new Date();
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      setActiveCommand({
        command,
        mode: 'TIMER',
        duration: durationMinutes,
        remainingSeconds: durationMinutes * 60,
        endTime,
        isActive: true,
      });

      timerIntervalRef.current = setInterval(() => {
        setActiveCommand((prev) => {
          if (!prev || !prev.endTime) return null;
          const now = new Date();
          const remaining = Math.max(0, Math.floor((prev.endTime.getTime() - now.getTime()) / 1000));
          if (remaining <= 0) {
            clearTimer();
            sendIdleCommand();
            return null;
          }
          return { ...prev, remainingSeconds: remaining };
        });
      }, 1000);
    },
    [clearTimer, operationMode, sendIdleCommand]
  );

  // Power komutu gönder
  const sendPowerCommand = useCallback(
    async (chargeStatus: 'Charge' | 'Discharge') => {
      setIsLoading(true);

      // Timer modunda: kullanıcının seçtiği süre
      // Sürekli modda: 1 yıl (365 gün = 31536000 saniye)
      const durationSeconds = operationMode === 'TIMER' ? durationMinutes * 60 : 31536000; // 1 yıl

      const requestBody: any = {
        charge_status: chargeStatus,
        power_kw: powerKw,
        duration_seconds: durationSeconds,
      };
      if (selectedRackId !== null) {
        requestBody.rack_id = selectedRackId;
      }

      try {
        const response = await fetch(`${API_URL}/api/commands/power`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const targetText = selectedRackId ? `Rack ${selectedRackId}` : "Tüm rack'ler";
        setMessage({
          type: 'success',
          text:
            operationMode === 'TIMER'
              ? `${targetText} ${chargeStatus === 'Charge' ? 'şarja' : 'deşarja'} başladı! ${durationMinutes} dakika sonra otomatik duracak.`
              : `${targetText} ${chargeStatus === 'Charge' ? 'şarja' : 'deşarja'} başladı! (Sürekli mod)`,
        });

        if (operationMode === 'TIMER' && selectedRackId !== null) {
          startTimer(chargeStatus === 'Charge' ? 'CHARGE' : 'DISCHARGE', durationMinutes);
        } else if (operationMode === 'CONTINUOUS') {
          setActiveCommand({
            command: chargeStatus === 'Charge' ? 'CHARGE' : 'DISCHARGE',
            mode: 'CONTINUOUS',
            isActive: true,
          });
        }

        setTimeout(() => setMessage(null), 5000);
        setTimeout(() => loadRacks(false), 500);
      } catch (error) {
        console.error('Power command failed:', error);
        setMessage({ type: 'error', text: 'Komut gönderilemedi!' });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setIsLoading(false);
      }
    },
    [API_URL, selectedRackId, operationMode, durationMinutes, powerKw, startTimer, loadRacks]
  );

  const sendEmergencyStop = useCallback(async () => {
    setIsLoading(true);
    try {
      const requestBody: any = {
        charge_status: 'Idle',
        power_kw: 0,
        duration_seconds: 0,
      };
      if (selectedRackId !== null) {
        requestBody.rack_id = selectedRackId;
      }

      await fetch(`${API_URL}/api/commands/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      clearTimer();
      setActiveCommand(null);
      setMessage({
        type: 'info',
        text: selectedRackId ? `Rack ${selectedRackId} durduruldu!` : "Tüm rack'ler durduruldu!",
      });
      setTimeout(() => setMessage(null), 3000);
      setTimeout(() => loadRacks(false), 500);
    } catch (error) {
      setMessage({ type: 'error', text: 'Durdurma başarısız!' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, selectedRackId, clearTimer, loadRacks]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedRack = racks.find((r) => r.id === selectedRackId);
  const hasActiveCommand = activeCommand?.isActive ?? false;

  const getStatusColor = (status: string): 'success' | 'error' => {
    return status === 'online' ? 'success' : 'error';
  };

  const getChargeStatusColor = (chargeStatus: string | null): 'success' | 'warning' | 'secondary' => {
    if (chargeStatus === 'Charge') return 'success';
    if (chargeStatus === 'Discharge') return 'warning';
    return 'secondary';
  };

  const skeletonCount = Math.max(racks.length, 8);

  return (
    <div className={styles.container} style={{ width, height }}>
      <div className={styles.header}>
        <h2 className={styles.title}>🔋 Battery Rack Controller</h2>
        <Text color="secondary">Rack&apos;leri toplu veya tekil kontrol et</Text>
      </div>

      {activeCommand && activeCommand.isActive && (
        <Card
          style={{
            marginBottom: '24px',
            background:
              activeCommand.command === 'CHARGE'
                ? 'linear-gradient(135deg, #1a3a2a 0%, #0d1b0d 100%)'
                : 'linear-gradient(135deg, #3a2a1a 0%, #1b0d0d 100%)',
            border: `2px solid ${activeCommand.command === 'CHARGE' ? '#4caf50' : '#ff9800'}`,
          }}
        >
          <Card.Heading>{activeCommand.command === 'CHARGE' ? '🔋 ŞARJ AKTİF' : '⚡ DEŞARJ AKTİF'}</Card.Heading>
          <Card.Description>
            <Stack direction="column" gap={1}>
              <Badge text={activeCommand.mode === 'TIMER' ? '⏱️ Timer Modu' : '🔄 Sürekli Mod'} color="blue" />
              {activeCommand.mode === 'TIMER' && activeCommand.remainingSeconds !== undefined && (
                <>
                  <div className={styles.timerDisplay}>{formatTime(activeCommand.remainingSeconds)}</div>
                  <Text color="secondary">Kalan süre</Text>
                </>
              )}
              {activeCommand.mode === 'CONTINUOUS' && <Text color="secondary">♾️ Süresiz devam ediyor...</Text>}
            </Stack>
          </Card.Description>
        </Card>
      )}

      <div className={styles.mainLayout}>
        <div className={styles.racksSection}>
          <div className={styles.refreshHeader}>
            <h4 className={styles.sectionTitle}>🎯 Rack Seç</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Badge
                text={autoRefresh ? '🔄 Auto Refresh 5s' : '⏸️ Auto Refresh Kapalı'}
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{ cursor: 'pointer' }}
                color="blue"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                icon="sync"
              >
                {isRefreshing ? 'Yenileniyor...' : 'Yenile'}
              </Button>
            </div>
          </div>

          <div className={styles.rackGrid}>
            {/* Tüm Rack'ler Kartı */}
            <div
              className={`${styles.rackCard} ${!selectedRackId ? styles.rackCardSelected : ''} ${isRefreshing ? styles.rackCardLoading : ''}`}
              onClick={() => !isRefreshing && setSelectedRackId(null)}
            >
              <div className={styles.rackName}>
                🎯 Tüm Rack&apos;ler
                <Badge text="Toplu Kontrol" color="purple" />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Tüm rack&apos;lere toplu komut gönder
              </div>
            </div>

            {isRefreshing && racks.length === 0
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={`skeleton-${i}`} className={styles.skeletonCard}>
                    <div
                      style={{
                        height: '20px',
                        background: 'var(--grays-700)',
                        borderRadius: '4px',
                        marginBottom: '10px',
                      }}
                    />
                    <div
                      style={{ height: '16px', background: 'var(--grays-700)', borderRadius: '4px', width: '60%' }}
                    />
                  </div>
                ))
              : racks.map((rack) => (
                  <div
                    key={rack.id}
                    className={`${styles.rackCard} ${selectedRackId === rack.id ? styles.rackCardSelected : ''} ${isRefreshing ? styles.rackCardLoading : ''}`}
                    onClick={() => !isRefreshing && setSelectedRackId(rack.id)}
                  >
                    <div className={styles.rackName}>
                      {rack.name}
                      <Badge text={rack.status || 'unknown'} color={getStatusColor(rack.status || 'offline')} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <Badge text={rack.charge_status || 'Idle'} color={getChargeStatusColor(rack.charge_status)} />
                      <Badge text={`SoC: ${rack.soc ?? 'N/A'}%`} color="blue" />
                    </div>
                    <div className={styles.rackDetails}>
                      <div className={styles.rackDetailItem}>
                        <span>🔋 Voltage:</span>
                        <strong>{rack.voltage ?? 'N/A'} mV</strong>
                      </div>
                      <div className={styles.rackDetailItem}>
                        <span>⚡ Current:</span>
                        <strong>{rack.current ?? 'N/A'} A</strong>
                      </div>
                      <div className={styles.rackDetailItem}>
                        <span>💪 Power:</span>
                        <strong>{rack.power_kw ?? 'N/A'} kW</strong>
                      </div>
                      <div className={styles.rackDetailItem}>
                        <span>🌡️ Temp:</span>
                        <strong>{rack.temperature ?? 'N/A'} °C</strong>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        <div className={styles.controlSection}>
          <h4 className={styles.sectionTitle}>🎮 Kontrol Paneli</h4>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>🎯 Çalışma Modu</h4>
            <RadioButtonGroup
              options={[
                { value: 'TIMER', label: '⏱️ Timer Modu' },
                { value: 'CONTINUOUS', label: '🔄 Sürekli Mod' },
              ]}
              value={operationMode}
              onChange={(value) => setOperationMode(value as 'TIMER' | 'CONTINUOUS')}
              size="md"
              disabled={hasActiveCommand}
            />
          </div>

          {operationMode === 'TIMER' && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>⏱️ Süre (Dakika)</h4>
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.currentTarget.value))}
                min={1}
                max={480}
                step={5}
                suffix="dakika"
                width={40}
                disabled={hasActiveCommand}
              />
              <Text color="secondary">Süre dolduğunda otomatik Idle&apos;a geçer.</Text>
            </div>
          )}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>⚡ Güç (kW)</h4>
            <Input
              type="number"
              value={powerKw}
              onChange={(e) => setPowerKw(Number(e.currentTarget.value))}
              min={0}
              max={500}
              step={10}
              suffix="kW"
              width={40}
              disabled={hasActiveCommand}
            />
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>🔘 Kontrol</h4>
            <div className={styles.buttonGroup}>
              <Button
                onClick={() => sendPowerCommand('Charge')}
                disabled={isLoading || isRefreshing || hasActiveCommand}
                style={{ backgroundColor: '#4caf50', minWidth: '120px' }}
              >
                🔋 ŞARJ
              </Button>
              <Button
                onClick={() => sendPowerCommand('Discharge')}
                disabled={isLoading || isRefreshing || hasActiveCommand}
                style={{ backgroundColor: '#ff9800', minWidth: '120px' }}
              >
                ⚡ DEŞARJ
              </Button>
              <Button
                onClick={sendEmergencyStop}
                disabled={isLoading || !hasActiveCommand || isRefreshing}
                variant="destructive"
                style={{ minWidth: '120px' }}
              >
                🛑 DURDUR
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>📋 Seçili Rack</h4>
            {selectedRack ? (
              <div className={styles.rackInfo}>
                <Stack direction="column" gap={2}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Rack:</Text>
                    <strong>{selectedRack.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Status:</Text>
                    <Badge
                      text={selectedRack.status || 'unknown'}
                      color={getStatusColor(selectedRack.status || 'offline')}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Charge Status:</Text>
                    <Badge
                      text={selectedRack.charge_status || 'Idle'}
                      color={getChargeStatusColor(selectedRack.charge_status)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">SoC:</Text>
                    <strong>{selectedRack.soc ?? 'N/A'}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">SoH:</Text>
                    <strong>{selectedRack.soh ?? 'N/A'}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Voltage:</Text>
                    <strong>{selectedRack.voltage ?? 'N/A'} mV</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Current:</Text>
                    <strong>{selectedRack.current ?? 'N/A'} A</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Power:</Text>
                    <strong>{selectedRack.power_kw ?? 'N/A'} kW</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text color="secondary">Temperature:</Text>
                    <strong>{selectedRack.temperature ?? 'N/A'} °C</strong>
                  </div>
                </Stack>
              </div>
            ) : (
              <div className={styles.rackInfo}>
                <Text color="secondary">
                  Bir rack seçin veya
                  <br />
                  &quot;Tüm Rack&apos;ler&quot; ile toplu kontrol yapın.
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div style={{ marginTop: '16px' }}>
          <Alert
            title={message.type === 'success' ? 'Başarılı!' : message.type === 'error' ? 'Hata!' : 'Bilgi'}
            severity={message.type}
            onRemove={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        </div>
      )}

      <div className={styles.infoBox}>
        <Text color="secondary">
          💡 {selectedRackId ? `Seçili: ${selectedRack?.name}` : "Tüm rack'ler toplu kontrol ediliyor."}
          {operationMode === 'TIMER'
            ? ' Timer modunda süre dolunca otomatik Idle.'
            : ' Sürekli modda DURDUR butonu ile durdur.'}
          {autoRefresh && !hasActiveCommand && ' 🔄 Her 5 saniyede otomatik yenileniyor.'}
          {hasActiveCommand && ' ⏳ Aktif komut devam ediyor...'}
        </Text>
      </div>
    </div>
  );
};
