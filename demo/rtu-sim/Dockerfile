FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir flask==3.0.3

COPY rtu.py .

EXPOSE 8080
CMD ["python", "rtu.py"]
