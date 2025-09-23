import React from 'react';

interface StepperProps {
  currentStep: number;
}

const steps = ['Story', 'Elements', 'Style', 'Chapter', 'Comic'];

const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full max-w-3xl mx-auto mb-12 px-4">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index;
          const isActive = currentStep === index;

          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-yellow-400 text-slate-900 scale-110 shadow-lg shadow-yellow-500/30'
                      : isCompleted
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <p
                  className={`mt-2 text-sm font-semibold text-center transition-colors duration-300 ${
                    isActive ? 'text-yellow-400' : isCompleted ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                >
                  {step}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded transition-colors duration-500 ${
                    isCompleted ? 'bg-cyan-600' : 'bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Stepper;
