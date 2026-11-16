SELECT *, topic(2) AS worker_id, timestamp() AS rx_ts FROM 'heattrace/+/data'
