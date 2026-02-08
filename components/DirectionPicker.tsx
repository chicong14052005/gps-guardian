import React, { useState } from 'react';
import { Navigation } from 'lucide-react';

interface DirectionPickerProps {
    onSelect: (direction: number, speed: number) => void;
    onCancel: () => void;
}

// 8 hướng chính với góc tương ứng
const DIRECTIONS = [
    { name: 'N', label: 'Bắc', angle: 0 },
    { name: 'NE', label: 'Đông Bắc', angle: 45 },
    { name: 'E', label: 'Đông', angle: 90 },
    { name: 'SE', label: 'Đông Nam', angle: 135 },
    { name: 'S', label: 'Nam', angle: 180 },
    { name: 'SW', label: 'Tây Nam', angle: 225 },
    { name: 'W', label: 'Tây', angle: 270 },
    { name: 'NW', label: 'Tây Bắc', angle: 315 },
];

const DirectionPicker: React.FC<DirectionPickerProps> = ({ onSelect, onCancel }) => {
    const [selectedAngle, setSelectedAngle] = useState<number | null>(null);
    const [customAngle, setCustomAngle] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [speed, setSpeed] = useState(35); // Default speed 35 km/h

    const handleDirectionClick = (angle: number) => {
        setSelectedAngle(angle);
        setUseCustom(false);
        setCustomAngle('');
    };

    const handleCustomAngle = (value: string) => {
        setCustomAngle(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num <= 360) {
            setSelectedAngle(num);
            setUseCustom(true);
        }
    };

    const handleSpeedChange = (value: number) => {
        const clampedValue = Math.max(0, Math.min(200, value));
        setSpeed(clampedValue);
    };

    const handleConfirm = () => {
        if (selectedAngle !== null) {
            onSelect(selectedAngle, speed);
        }
    };

    const isValidCustom = () => {
        const num = parseFloat(customAngle);
        return !isNaN(num) && num >= 0 && num <= 360;
    };

    // Calculate arrow rotation: Navigation icon points to top-right (NE = 45°)
    // To make it point to the correct direction, we need to add (selectedAngle - 45)
    // But since the icon by default points "up" visually when not rotated, we use the angle directly
    // The Navigation icon in Lucide points at around 45° (NE), so we need to offset by -45°
    const arrowRotation = selectedAngle !== null ? selectedAngle - 45 : -45;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold dark:text-white text-center">
                        🧭 Chọn hướng di chuyển
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                        Chọn hướng hoặc nhập góc (0° - 360°)
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Compass */}
                    <div className="relative w-56 h-56 mx-auto">
                        {/* Compass circle */}
                        <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />

                        {/* Center indicator - Arrow */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div
                                className="transition-transform duration-300"
                                style={{
                                    transform: `rotate(${arrowRotation}deg)`,
                                }}
                            >
                                <Navigation
                                    className={`w-8 h-8 transition-colors ${selectedAngle !== null ? 'text-primary' : 'text-gray-400'
                                        }`}
                                />
                            </div>
                        </div>

                        {/* Direction buttons */}
                        {DIRECTIONS.map((dir) => {
                            const radians = ((dir.angle - 90) * Math.PI) / 180;
                            const x = 50 + 42 * Math.cos(radians);
                            const y = 50 + 42 * Math.sin(radians);

                            return (
                                <button
                                    key={dir.name}
                                    onClick={() => handleDirectionClick(dir.angle)}
                                    className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedAngle === dir.angle && !useCustom
                                        ? 'bg-primary text-white scale-110'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                    title={dir.label}
                                >
                                    {dir.name}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom angle input */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                            Hoặc nhập góc tùy chỉnh:
                        </label>
                        <div className="flex gap-2 items-center justify-center">
                            <input
                                type="number"
                                value={customAngle}
                                onChange={(e) => handleCustomAngle(e.target.value)}
                                className={`w-24 px-3 py-2 border rounded-lg text-center bg-gray-50 dark:bg-gray-800 dark:text-white outline-none ${useCustom && isValidCustom()
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-gray-300 dark:border-gray-600'
                                    }`}
                                placeholder="0 - 360"
                                min={0}
                                max={360}
                            />
                            <span className="text-gray-500">độ (°)</span>
                        </div>
                        {customAngle && !isValidCustom() && (
                            <p className="text-xs text-red-500 text-center mt-1">Góc phải từ 0° đến 360°</p>
                        )}
                    </div>

                    {/* Speed Control */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-center">
                            Tốc độ di chuyển:
                        </label>
                        {/* Speed value display - centered below label */}
                        <div className="flex items-center justify-center gap-1 mb-3">
                            <input
                                type="number"
                                value={speed}
                                onChange={(e) => handleSpeedChange(parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-gray-50 dark:bg-gray-800 dark:text-white outline-none text-lg font-bold focus:ring-2 focus:ring-primary/50"
                                min={0}
                                max={200}
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">km/h</span>
                        </div>
                        {/* Slider */}
                        <input
                            type="range"
                            min={0}
                            max={200}
                            value={speed}
                            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                            <span>150</span>
                            <span>200</span>
                        </div>
                    </div>

                    {/* Selected angle display */}
                    {selectedAngle !== null && (
                        <div className="mt-4 text-center bg-gradient-to-r from-primary/5 to-secondary/5 p-3 rounded-lg border border-primary/20">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Hướng đã chọn: </span>
                            <span className="text-lg font-bold text-primary">{selectedAngle}°</span>
                            {!useCustom && (
                                <span className="text-sm text-gray-500 ml-2">
                                    ({DIRECTIONS.find((d) => d.angle === selectedAngle)?.label})
                                </span>
                            )}
                            <br />
                            <span className="text-sm text-gray-500 dark:text-gray-400">Tốc độ: </span>
                            <span className="text-lg font-bold text-primary">{speed} km/h</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedAngle === null}
                        className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Bắt đầu mô phỏng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DirectionPicker;
