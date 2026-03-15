const FloatingShape = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '6s' }}
      />
      <div
        className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/8 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '8s', animationDelay: '2s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/3 rounded-full blur-2xl animate-pulse"
        style={{ animationDuration: '10s', animationDelay: '4s' }}
      />
    </div>
  );
};

export default FloatingShape;